const { Telegraf } = require('telegraf');
const Markup = require('telegraf/markup');
const Extra = require('telegraf/extra');
const session = require('telegraf/session');
const AdmZip = require('adm-zip');
var request = require('request-promise').defaults({encoding: null});
const PDFDocument = require('pdfkit');
var MemoryStream = require('memorystream');

var newKeyboard = Markup
    .keyboard(['Новый документ'])
    .resize();
var downloadKeyboard = Markup
    .keyboard([['Скачать PDF', 'Скачать ZIP'], ['Новый документ']])
    .resize();

const bot = new Telegraf('TOKEN');
bot.use(session());

bot.start((ctx) => ctx.reply('Добро пожаловать. Бот может сжать ваши изображения и создать ZIP архив или PDF файл. Для начала работы нажмите на <b>Новый документ</b>.', Extra.HTML().markup(newKeyboard)));
bot.hears('Новый документ', (ctx) => {
    ctx.session.images = [];
    ctx.reply('Отправьте фотографии которые необходимо объединить в документ. Далее нажмите на <b>Скачать</b>.', Extra.HTML().markup(downloadKeyboard));
});
bot.on('photo', (ctx) => {
    if (!ctx.session.images) {
        ctx.reply('Создайте новый документ для начала', newKeyboard.extra());
        return;
    }
    let best_photo = ctx.message.photo[ctx.message.photo.length - 1];
    ctx.session.images.push(best_photo);
});
bot.hears('Скачать ZIP', async (ctx) => {
    if (!ctx.session.images || ctx.session.images.length <= 0) {
        ctx.reply('Загрузите какие нибудь фотографии', downloadKeyboard.extra());
        return;
    }
    ctx.replyWithChatAction('upload_document');
    let urls = ctx.session.images.map((url) => {
        return ctx.telegram.getFileLink(url.file_id);
    });
    let urlsData = await Promise.all(urls);
    let photos = urlsData.map((download) => {
        return request.get(download);
    });
    let photosData = await Promise.all(photos);
    let zip = new AdmZip();
    photosData.map((bufferData, index) => {
        zip.addFile(index + '.jpg', bufferData);
    });
    ctx.replyWithDocument({
        filename: 'document.zip',
        source: zip.toBuffer()
    }, newKeyboard.extra());
    ctx.session.images = null;
});
bot.hears('Скачать PDF', async (ctx) => {
    if (!ctx.session.images || ctx.session.images.length <= 0) {
        ctx.reply('Загрузите какие нибудь фотографии', downloadKeyboard.extra());
        return;
    }
    ctx.replyWithChatAction('upload_document');
    let urls = ctx.session.images.map((url) => {
        return ctx.telegram.getFileLink(url.file_id);
    });
    let urlsData = await Promise.all(urls);
    let photos = urlsData.map((download) => {
        return request.get(download);
    });
    let photosData = await Promise.all(photos);
    const doc = new PDFDocument({
        autoFirstPage: false
    });
    var memStream = new MemoryStream();
    doc.pipe(memStream);
    photosData.map((bufferData, index) => {
        let buf = Buffer.from(bufferData, 'binary');
        doc.addPage({
            margin: 0,
            size: [ctx.session.images[index].width, ctx.session.images[index].height]
        }).image(buf);
    });
    doc.end();
    ctx.replyWithDocument({
        filename: 'document.pdf',
        source: memStream
    }, newKeyboard.extra());
    ctx.session.images = null;
});
