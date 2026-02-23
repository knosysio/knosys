import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from '@koa/bodyparser';
import { API_PREFIX } from './constants';
import { checkAppConfig } from './middlewares/app';
import appRouter from './apis/app';
import qiiRouter from './apis/qii';

const app = new Koa();
const router = new Router({ prefix: API_PREFIX });

router.use('/app', appRouter.routes());
router.use('/qii', qiiRouter.routes());

app.use(bodyParser());
app.use(checkAppConfig);
app.use(router.routes()).use(router.allowedMethods());

app.listen(8001, () => console.log('接口服务启动了'));
