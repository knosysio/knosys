const Koa = require('koa');
const bodyParser = require('koa-bodyparser');

const { API_PREFIX } = require('./constants');

const router = require('@koa/router')({ prefix: API_PREFIX });

const { checkAppConfig } = require('./middlewares/app');
const appRouter = require('./apis/app');
const qiiRouter = require('./apis/qii');

const app = new Koa();

router.use('/app', appRouter.routes());
router.use('/qii', qiiRouter.routes());

app.use(bodyParser());
app.use(checkAppConfig);
app.use(router.routes()).use(router.allowedMethods());

app.listen(8001, () => console.log('接口服务启动了'));
