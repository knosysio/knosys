const Koa = require('koa');
const router = require('@koa/router')({ prefix: '/api' });

const { checkAppConfig } = require('./middlewares/app');
const qii = require('./apis/qii');

const app = new Koa();

router.use('/qii', qii.routes());

app.use(checkAppConfig);
app.use(router.routes()).use(router.allowedMethods());

app.listen(8001, () => console.log('接口服务启动了'));
