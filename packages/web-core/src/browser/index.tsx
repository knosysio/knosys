import { createContext, useContext, useEffect, useState, useCallback, type ReactElement, type ReactNode, type FormEvent } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Modal, Spinner } from '@heroui/react';
import { BookOpenIcon, FolderIcon, PlusIcon, Cog6ToothIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { CoreEnvironment, Envelope, App, CollectionData, RecordData, MenuItem } from '../contracts/index';
import { renderMarkdown } from './markdown';
import { InformationPopover, HelpTooltip } from './overlays';

const Environment = createContext<CoreEnvironment | null>(null);
function useEnvironment(): CoreEnvironment { const value: CoreEnvironment | null = useContext(Environment); if (!value) throw new Error('KnoSys environment missing'); return value; }
export function coreUrl(basePath: string, route: string, values: Record<string, string> = {}): string { const query: string = new URLSearchParams(values).toString(); return (basePath.replace(/\/$/, '') + (route === '/' ? '' : route) || '/') + (query ? '?' + query : ''); }
async function request<T>(environment: CoreEnvironment, route: string, values: Record<string, string> = {}, input?: unknown, method: string = 'GET'): Promise<Envelope<T>> {
  const response: Response = await environment.fetch(environment.apiBase + route + '?' + new URLSearchParams(values), { method, ...(input === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }) });
  const result: Envelope<T> = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || result.code || '请求失败');
  return result;
}
function useLoad<T>(route: string, values: Record<string, string>, fallback: T): { data: T; error: string; loading: boolean; reload: () => void; extra?: Envelope<T>['extra'] } {
  const environment: CoreEnvironment = useEnvironment();
  const key: string = JSON.stringify(values);
  const [data, setData] = useState<T>(fallback); const [error, setError] = useState<string>(''); const [loading, setLoading] = useState<boolean>(true); const [version, setVersion] = useState<number>(0); const [extra, setExtra] = useState<Envelope<T>['extra']>();
  useEffect((): (() => void) => {
    let active: boolean = true; setLoading(true); setError('');
    request<T>(environment, route, JSON.parse(key)).then((result: Envelope<T>): void => { if (active) { setData(result.data); setExtra(result.extra); } }).catch((reason: unknown): void => { if (active) setError(reason instanceof Error ? reason.message : '加载失败'); }).finally((): void => { if (active) setLoading(false); });
    return (): void => { active = false; };
  }, [environment, route, key, version]);
  return { data, error, loading, reload: (): void => setVersion((current: number): number => current + 1), extra };
}
function State({ loading, error, children }: { loading: boolean; error: string; children: ReactNode }): ReactElement {
  if (loading) return <div className="flex justify-center p-12" role="status"><Spinner aria-label="加载中" /></div>;
  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900">{error}</div>;
  return <>{children}</>;
}
function useIds(): { app: string; collection: string; record: string } { const [query] = useSearchParams(); return { app: query.get('app') || '', collection: query.get('collection') || '', record: query.get('record') || '' }; }
function Breadcrumbs({ title }: { title: string }): ReactElement { const environment: CoreEnvironment = useEnvironment(); return <nav aria-label="面包屑" className="mb-4 flex gap-2 text-sm text-gray-500"><Link to={coreUrl(environment.basePath, '/')}>知识库</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span></nav>; }
function HomePage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const result = useLoad<App[]>('/apps', {}, []);
  return <><header className="knosys-heading"><div><h1>知识库</h1><p>在应用与集合中整理、阅读和编辑知识。</p></div><Link to={coreUrl(environment.basePath, '/settings')} aria-label="设置"><Cog6ToothIcon className="size-5" /></Link></header><State {...result}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><Link className="knosys-card knosys-create" to={coreUrl(environment.basePath, '/initialize')}><PlusIcon className="size-8" /><span>添加知识库</span></Link>{result.data.map((app: App): ReactElement => <Link className="knosys-card" key={app.name} to={coreUrl(environment.basePath, '/app', { app: app.name })}><BookOpenIcon className="size-7 text-green-600" /><h2>{app.title || app.name}</h2><p>{app.name}</p>{app.status !== 'available' && <span className="text-amber-700">{app.status}</span>}</Link>)}</div></State></>;
}
function AppPage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const { app } = useIds(); const result = useLoad<CollectionData[]>('/collections', { app }, []);
  return <><Breadcrumbs title={app} /><header className="knosys-heading"><h1>{app}</h1><Link to={coreUrl(environment.basePath, '/settings', { app })}>应用配置</Link></header><State {...result}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.data.map((collection: CollectionData): ReactElement => <Link className="knosys-card" key={collection.id} to={coreUrl(environment.basePath, '/collection', { app, collection: collection.id })}><FolderIcon className="size-7 text-green-600" /><h2>{collection.title}</h2><p>{collection.path}</p></Link>)}</div>{result.data.length === 0 && <p className="p-6 text-gray-500">没有可用集合，请检查源的 path schema。</p>}</State></>;
}
function CollectionPage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const { app, collection } = useIds(); const [query, setQuery] = useSearchParams(); const page: string = query.get('pageNum') || '1'; const result = useLoad<RecordData[]>('/records', { app, collection, pageNum: page, pageSize: '20' }, []);
  return <><Breadcrumbs title="集合" /><header className="knosys-heading"><h1>集合记录</h1>{result.extra?.writable !== false && <Link className="knosys-action" to={coreUrl(environment.basePath, '/editor', { app, collection })}><PlusIcon className="size-4" />新建 Markdown</Link>}</header><State {...result}><div className="overflow-x-auto rounded-xl border border-gray-200"><table className="w-full text-left"><thead><tr><th>标题</th><th>描述</th><th>日期</th></tr></thead><tbody>{result.data.map((record: RecordData): ReactElement => <tr key={record.id}><td><Link className="text-blue-600 hover:underline" to={coreUrl(environment.basePath, '/record', { app, collection, record: record.id })}>{String(record.fields.title || record.id)}</Link></td><td>{String(record.fields.description || '')}</td><td>{record.fields.date ? String(record.fields.date).slice(0, 10) : '—'}</td></tr>)}</tbody></table>{result.data.length === 0 && <p className="p-8 text-center text-gray-500">暂无记录</p>}</div><footer className="mt-4 flex flex-wrap items-center justify-end gap-3"><span className="mr-auto text-sm text-gray-500">共 {result.extra?.total || 0} 条 · 第 {page} 页</span><Button variant="secondary" isDisabled={Number(page) <= 1} onPress={(): void => { query.set('pageNum', String(Number(page) - 1)); setQuery(query); }}>上一页</Button><Button variant="secondary" isDisabled={Number(page) * 20 >= (result.extra?.total || 0)} onPress={(): void => { query.set('pageNum', String(Number(page) + 1)); setQuery(query); }}>下一页</Button></footer></State></>;
}
function Markdown({ content, record }: { content: string; record?: RecordData }): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const ids = useIds();
  const html: string = renderMarkdown(content, record?.attachments || [], (attachment: string): string => environment.apiBase + '/attachment?' + new URLSearchParams({ ...ids, attachment }));
  return <article className="knosys-markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
function RecordPage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const ids = useIds(); const navigate = useNavigate(); const result = useLoad<RecordData | null>('/record', ids, null); const [confirm, setConfirm] = useState<boolean>(false); const [busy, setBusy] = useState<boolean>(false);
  async function remove(): Promise<void> {
    if (!result.data) return; setBusy(true);
    try { await request(environment, '/record', ids, { expectedRevision: result.data.revision }, 'DELETE'); environment.notify('记录已删除', 'success'); navigate(coreUrl(environment.basePath, '/collection', { app: ids.app, collection: ids.collection })); }
    catch (error) { environment.notify(error instanceof Error ? error.message : '删除失败', 'error'); } finally { setBusy(false); }
  }
  return <><Breadcrumbs title="记录详情" /><State {...result}>{result.data && <><header className="knosys-heading"><div><h1>{String(result.data.fields.title || '无标题')}</h1><p>{String(result.data.fields.description || '')}</p></div>{result.data.writable !== false && <div className="flex gap-2"><Link className="knosys-action" to={coreUrl(environment.basePath, '/editor', ids)}><PencilSquareIcon className="size-4" />编辑</Link><Button variant="outline" className="border-red-300 text-red-600" onPress={(): void => setConfirm(true)}><TrashIcon className="size-4" />删除</Button></div>}</header>{result.data.attachments.filter((attachment): boolean => /^cover\.(png|jpe?g|gif|webp)$/i.test(attachment.name)).slice(0, 1).map((attachment): ReactElement => <img key={attachment.id} className="mb-6 max-h-80 w-full rounded-xl object-cover" alt="封面" src={environment.apiBase + '/attachment?' + new URLSearchParams({ ...ids, attachment: attachment.id })} />)}<Markdown content={result.data.content} record={result.data} /><section className="mt-8"><h2 className="mb-3 font-semibold">附件</h2>{result.data.attachments.map((attachment): ReactElement => <a className="mr-4 break-all text-blue-600" key={attachment.id} href={environment.apiBase + '/attachment?' + new URLSearchParams({ ...ids, attachment: attachment.id })}>{attachment.name}</a>)}</section></>}</State><Modal isOpen={confirm} onOpenChange={setConfirm}><Modal.Backdrop UNSTABLE_portalContainer={environment.portalContainer} isDismissable={!busy}><Modal.Container><Modal.Dialog className="w-[min(480px,calc(100vw-24px))]"><Modal.Header><Modal.Heading>删除记录</Modal.Heading></Modal.Header><Modal.Body>删除正文、元数据与此记录的附件，此操作无法撤销。</Modal.Body><Modal.Footer className="flex justify-end gap-2"><Button variant="secondary" isDisabled={busy} onPress={(): void => setConfirm(false)}>取消</Button><Button variant="outline" className="border-red-300 text-red-600" isDisabled={busy} onPress={(): void => { void remove(); }}>确认删除</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop></Modal></>;
}
function fieldText(document: RecordData | null, name: string): string {
  const value: unknown = document?.fields[name]; const text: string = name === 'tags' ? Array.isArray(value) ? value.join(', ') : '' : String(value ?? '');
  return ['title', 'description'].includes(name) ? text.replace(/\r\n?/g, '\n') : text.replace(/[\r\n]/g, '');
}
function EditorPage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const ids = useIds(); const navigate = useNavigate(); const [document, setDocument] = useState<RecordData | null>(null); const [parameters, setParameters] = useState<string[]>([]); const [error, setError] = useState<string>(''); const [loading, setLoading] = useState<boolean>(true); const [busy, setBusy] = useState<boolean>(false); const [content, setContent] = useState<string>('');
  useEffect((): (() => void) => {
    let active: boolean = true;
    const load = async (): Promise<void> => {
      try {
        if (ids.record) { const result = await request<RecordData>(environment, '/document', ids); if (active) { if (result.data.writable === false) throw new Error('请先使用本地 CLI 迁移或重新登记应用，再启用写入。'); setDocument(result.data); setContent(result.data.content); } }
        else { const result = await request<CollectionData[]>(environment, '/collections', { app: ids.app }); const collection = result.data.find((item: CollectionData): boolean => item.id === ids.collection); if (!collection) throw new Error('集合不存在'); if (collection.capabilities?.create === false) throw new Error('请先使用本地 CLI 迁移或重新登记应用，再启用写入。'); if (active) setParameters(collection.parameters); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : '加载失败'); } finally { if (active) setLoading(false); }
    }; void load(); return (): void => { active = false; };
  }, [environment, ids.app, ids.collection, ids.record]);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const form: FormData = new FormData(event.currentTarget); const fields: Record<string, unknown> = {};
    for (const name of ['title', 'description', 'date', 'tags']) { const raw: string = String(form.get(name) || ''); const value: unknown = name === 'tags' ? raw.split(',').map((tag: string): string => tag.trim()).filter(Boolean) : raw; if (raw !== fieldText(document, name)) fields[name] = value; }
    setBusy(true);
    try {
      const values: Record<string, string> = Object.fromEntries(parameters.map((name: string): [string, string] => [name, String(form.get('parameter:' + name) || '')]));
      const result = await request<RecordData>(environment, '/record', ids.record ? ids : { app: ids.app, collection: ids.collection }, ids.record ? { fields, content, expectedRevision: document!.revision } : { fields, content, parameters: values }, ids.record ? 'PUT' : 'POST');
      environment.notify('记录已保存', 'success'); navigate(coreUrl(environment.basePath, '/record', { ...ids, record: result.data.id }));
    } catch (reason) { environment.notify(reason instanceof Error ? reason.message : '保存失败', 'error'); } finally { setBusy(false); }
  }
  return <><Breadcrumbs title={ids.record ? '编辑 Markdown' : '新建 Markdown'} /><State loading={loading} error={error}><form id="knosys-editor" onSubmit={(event): void => { void submit(event); }}><header className="knosys-heading"><h1>{ids.record ? '编辑 Markdown' : '新建 Markdown'}</h1><HelpTooltip container={environment.portalContainer} label="编辑帮助">原文与预览使用相同的安全渲染；保存冲突时请先重新加载。</HelpTooltip></header><div className="grid gap-4 sm:grid-cols-2">{parameters.map((name: string): ReactElement => <label key={name}>{name}<input name={'parameter:' + name} required /></label>)}{['title', 'description', 'date', 'tags'].map((name: string): ReactElement => <label key={name}>{{ title: '标题', description: '描述', date: '日期', tags: '标签（逗号分隔）' }[name]}{name === 'title' || name === 'description' ? <textarea rows={name === 'title' ? 1 : 2} name={name} defaultValue={fieldText(document, name)} /> : <input name={name} defaultValue={fieldText(document, name)} />}</label>)}</div><div className="mt-5 grid gap-4 xl:grid-cols-2"><label>Markdown 原文<textarea aria-label="Markdown 原文" className="min-h-80 font-mono" value={content} onChange={(event): void => setContent(event.target.value)} /></label><section aria-label="实时预览" className="rounded-xl border border-gray-200 p-5"><h2 className="mb-4 font-semibold text-gray-500">实时预览</h2><Markdown content={content} record={document || undefined} /></section></div><footer className="mt-5 flex justify-end gap-2"><Button variant="secondary" isDisabled={busy} onPress={(): void => { void navigate(-1); }}>取消</Button><Button type="submit" isDisabled={busy}>保存</Button></footer></form></State></>;
}
function InitializePage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const navigate = useNavigate(); const [busy, setBusy] = useState<boolean>(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const form: FormData = new FormData(event.currentTarget); setBusy(true);
    try { const input = Object.fromEntries(form.entries()); if (input.mode === 'register') { delete input.pathSchema; delete input.collection; } await request(environment, '/initialize', {}, input, 'POST'); environment.notify('知识库已添加', 'success'); navigate(coreUrl(environment.basePath, '/app', { app: String(input.appName) })); }
    catch (reason) { environment.notify(reason instanceof Error ? reason.message : '初始化失败', 'error'); } finally { setBusy(false); }
  }
  return <><Breadcrumbs title="添加知识库" /><h1 className="mb-6 text-2xl font-semibold">添加知识库</h1><form className="knosys-form" onSubmit={(event): void => { void submit(event); }}><label>模式<select name="mode"><option value="register">登记已有 QiiDB 源</option><option value="create">创建新的 QiiDB 源</option></select></label><label>应用标识<input name="appName" required /></label><label>显示名称<input name="title" /></label><label>项目根目录<input name="projectRoot" required placeholder="已授权的绝对目录" /></label><label>源的相对目录<input name="sourceRelative" required placeholder="data" /></label><label>创建时的路径模式<input name="pathSchema" defaultValue=":category/:collection/:slug" /></label><label>创建时的首集合<input name="collection" defaultValue="kb/notes" /></label><footer className="flex justify-end gap-2"><Button variant="secondary" onPress={(): void => { void navigate(-1); }}>取消</Button><Button type="submit" isDisabled={busy}>添加</Button></footer></form></>;
}
function ConfigurationForm({ app }: { app: string }): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const result = useLoad<{ fields: Record<string, unknown>; revision: string } | null>('/configuration', { app }, null); const [busy, setBusy] = useState<boolean>(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); if (!result.data) return; const title: string = String(new FormData(event.currentTarget).get('title') || ''); setBusy(true); try { await request(environment, '/configuration', { app }, { changes: { title }, expectedRevision: result.data.revision }, 'PUT'); environment.notify('配置已保存', 'success'); result.reload(); } catch (reason) { environment.notify(reason instanceof Error ? reason.message : '保存失败', 'error'); } finally { setBusy(false); } }
  return <State {...result}>{result.data && <form key={result.data.revision} className="knosys-form mt-6" onSubmit={(event): void => { void submit(event); }}><label>应用显示名称<input name="title" defaultValue={String(result.data.fields.title || '')} /></label><footer className="flex justify-end"><Button type="submit" isDisabled={busy}>保存配置</Button></footer></form>}</State>;
}
function SettingsPage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment();
  const { app } = useIds(); const result = useLoad<Record<string, unknown>>('/settings', {}, {});
  return <><Breadcrumbs title="设置" /><header className="knosys-heading"><h1>知识库设置</h1><InformationPopover container={environment.portalContainer} label="目录授权说明"><p>新源只能位于启动时允许的项目根目录中。修改授权目录后需要重启服务。</p></InformationPopover></header><State {...result}><dl className="knosys-card"><dt>登记目录</dt><dd className="break-all">{String(result.data.storageRoot || '')}</dd><dt>允许初始化的根目录</dt><dd className="break-all">{JSON.stringify(result.data.allowedRoots)}</dd><dt>数据格式</dt><dd>QiiDB</dd></dl></State>{app && <ConfigurationForm app={app} />}</>;
}
function LegacyPage(): ReactElement {
  const environment: CoreEnvironment = useEnvironment(); const location = useLocation(); const navigate = useNavigate();
  const relative: string = location.pathname.slice(environment.basePath.replace(/\/$/, '').length).replace(/^\//, '');
  let app: string; try { app = decodeURIComponent(relative.split('/')[0] || ''); } catch { app = ''; }
  const result = useLoad<{ collection: string; record?: string }[]>('/legacy', { app, url: location.pathname }, []);
  useEffect((): void => { if (!relative.includes('/') && app) { void navigate(coreUrl(environment.basePath, '/app', { app }), { replace: true }); return; } if (result.data.length === 1) { const target = result.data[0]; void navigate(coreUrl(environment.basePath, target.record ? '/record' : '/collection', { app, ...target }), { replace: true }); } }, [relative, app, result.data, environment, navigate]);
  return <State {...result}><h1>旧链接映射</h1>{result.data.length === 0 ? <p>没有找到保存的旧链接映射。</p> : <><p>此链接对应多个目标，请选择：</p>{result.data.map((target): ReactElement => <Link className="knosys-card mt-4" key={JSON.stringify(target)} to={coreUrl(environment.basePath, target.record ? '/record' : '/collection', { app, ...target })}>{target.record || target.collection}</Link>)}</>}</State>;
}
export function KnosysCore({ environment }: { environment: CoreEnvironment }): ReactElement {
  const location = useLocation();
  return <Environment.Provider value={environment}><div data-emotie-extension="knosys" className="knosys-core"><Routes key={location.pathname + location.search}><Route path="/" element={<HomePage />} /><Route path="app" element={<AppPage />} /><Route path="collection" element={<CollectionPage />} /><Route path="record" element={<RecordPage />} /><Route path="editor" element={<EditorPage />} /><Route path="initialize" element={<InitializePage />} /><Route path="settings" element={<SettingsPage />} /><Route path="*" element={<LegacyPage />} /></Routes></div></Environment.Provider>;
}
export function KnosysSidebar({ environment, onRoutesChange }: { environment: CoreEnvironment; onRoutesChange?: (routes: MenuItem[]) => void }): ReactElement | null {
  const [query] = useSearchParams(); const app: string = query.get('app') || ''; const [collections, setCollections] = useState<CollectionData[]>([]);
  useEffect((): (() => void) => { let active: boolean = true; setCollections([]); if (app) request<CollectionData[]>(environment, '/collections', { app }).then((result): void => { if (active) setCollections(result.data); }).catch((): void => {}); return (): void => { active = false; }; }, [environment, app]);
  useEffect((): void => { onRoutesChange?.([{ id: 'knosys-home', name: '知识库', icon: BookOpenIcon, path: coreUrl(environment.basePath, '/') }, ...collections.map((collection: CollectionData): MenuItem => ({ id: collection.id, name: collection.title, icon: FolderIcon, path: coreUrl(environment.basePath, '/collection', { app, collection: collection.id }) }))]); }, [collections, app, environment, onRoutesChange]);
  return onRoutesChange ? null : <nav aria-label="知识库集合" className="knosys-sidebar"><Link to={coreUrl(environment.basePath, '/')}><BookOpenIcon className="size-5" />全部知识库</Link>{collections.map((collection: CollectionData): ReactElement => <Link key={collection.id} to={coreUrl(environment.basePath, '/collection', { app, collection: collection.id })}><FolderIcon className="size-5" />{collection.title}</Link>)}</nav>;
}
