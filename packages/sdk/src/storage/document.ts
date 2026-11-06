import { existsSync, readFileSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import MarkdownIt from 'markdown-it';
const { safeLoad, safeDump } = yaml;
import { hash, contained, walk, jsonBytes } from './files';
import { fail, type Fields, type Attachment, type DocumentPatch } from './contracts';
import type { Mutation } from './transaction';

export type Overlay = Map<string, Buffer | null>;
interface FrontMatter { prefix: string; body: string; data: Fields }
export interface InternalDocument { content: string; fields: Fields; revision: string; attachments: Attachment[]; files: string[]; main?: string; front: FrontMatter; values: Map<string, Buffer> }
interface Heading { title: string; start: number; end: number; type: 'atx' | 'setext' | 'embedded' }
const markdown: MarkdownIt = new MarkdownIt({ html: false });
function lastHeading(content: string): Heading | undefined {
  const lines: string[] = content.split('\n'); const tokens = markdown.parse(content, {}); let found: Heading | undefined;
  for (let index: number = 0; index < tokens.length; index++) {
    const token = tokens[index]; if (token.type !== 'heading_open' || token.tag !== 'h1' || !token.map) continue;
    const start: number = token.map[0]; const end: number = token.map[1]; const first: string = lines[start].replace(/^\uFEFF/, '');
    const type: Heading['type'] = token.level > 0 ? 'embedded' : /^ {0,3}#(?:[ \t]|$)/.test(first) ? 'atx' : /^ {0,3}=+[ \t]*\r?$/.test(lines[end - 1]) ? 'setext' : 'embedded';
    found = { title: tokens[index + 1]?.content || '', start, end, type };
  }
  return found;
}
function replaceHeading(content: string, title: string): string {
  const heading: Heading | undefined = lastHeading(content); if (!heading || heading.type === 'embedded') fail(409, 'AMBIGUOUS_METADATA', 'Edit this heading directly in Markdown before changing its title field');
  const lines: string[] = content.split('\n'); const ending: string = lines[heading.start].endsWith('\r') ? '\r' : ''; const bom: string = heading.start === 0 && lines[0].startsWith('\uFEFF') ? '\uFEFF' : '';
  const replacement: string[] = heading.type === 'atx' && !title.includes('\n') || !title ? [bom + '# ' + title + ending] : title.split('\n').map((line: string, index: number): string => (index === 0 ? bom : '') + line + ending).concat(heading.type === 'setext' ? lines[heading.end - 1] : '===' + ending);
  lines.splice(heading.start, heading.end - heading.start, ...replacement); const result: string = lines.join('\n');
  if (lastHeading(result)?.title !== title) fail(409, 'AMBIGUOUS_METADATA', 'Title and Markdown heading cannot be represented consistently; edit the Markdown directly');
  return result;
}
function validUtf8(bytes: Buffer): boolean { return Buffer.from(bytes.toString('utf8')).equals(bytes); }
export function yamlObject(text: string): Fields {
  const parsed: unknown = safeLoad(text);
  if (parsed === undefined || parsed === null) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) fail(409, 'AMBIGUOUS_METADATA', 'Metadata must be a YAML mapping');
  return parsed as Fields;
}
export function splitFrontMatter(text: string): FrontMatter {
  const match: RegExpMatchArray | null = text.match(/^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n---(?:\r?\n|$))/);
  if (!match) return { prefix: '', body: text, data: {} };
  return { prefix: match[0], body: text.slice(match[0].length), data: yamlObject(match[2]) };
}
export function entityFiles(root: string, relative: string, overlay: Overlay): string[] {
  const full: string = contained(root, relative);
  const files: Set<string> = new Set(existsSync(full) ? walk(full, true).filter((file: string): boolean => !file.split('/').some((part: string): boolean => part === '.knosys')).map((file: string): string => relative + '/' + file) : []);
  for (const [file, bytes] of overlay) if (file.startsWith(relative + '/')) { if (bytes === null) files.delete(file); else files.add(file); }
  return [...files].sort();
}
export function readDocument(root: string, relative: string, overlay: Overlay = new Map()): InternalDocument {
  const files: string[] = entityFiles(root, relative, overlay);
  const values: Map<string, Buffer> = new Map(files.map((file: string): [string, Buffer] => [file.slice(relative.length + 1), overlay.get(file) || readFileSync(contained(root, file))]));
  const candidates: string[] = ['entity.yml', 'metadata.yml', 'basic.yml'];
  const main: string | undefined = candidates.find((file: string): boolean => values.has(file) && safeLoad(values.get(file)!.toString('utf8')) !== undefined && safeLoad(values.get(file)!.toString('utf8')) !== null) || candidates.find((file: string): boolean => values.has(file));
  if (!main && !values.has('readme.md')) fail(404, 'RECORD_NOT_FOUND', 'Record entity does not exist');
  const front: FrontMatter = splitFrontMatter(values.get('readme.md')?.toString('utf8') || '');
  const fields: Fields = { ...(main ? yamlObject(values.get(main)!.toString('utf8')) : {}), ...front.data };
  const heading: Heading | undefined = lastHeading(front.body);
  if (heading) fields.title = heading.title;
  const attachments: Attachment[] = [...values].filter(([file]: [string, Buffer]): boolean => !['entity.yml', 'metadata.yml', 'basic.yml', 'readme.md'].includes(file) && !file.startsWith('.')).map(([file, bytes]: [string, Buffer]): Attachment => ({ id: hash(file).slice(0, 32), name: path.basename(file), relativePath: file, sha256: hash(bytes) }));
  return { content: front.body, fields, revision: hash(jsonBytes([...values].map(([file, bytes]: [string, Buffer]): string[] => [file, hash(bytes)]))), attachments, files, main, front, values };
}
const EDITABLE: string[] = ['title', 'description', 'date', 'tags'];
export function validateFields(fields: Fields): void {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) fail(400, 'INVALID_FIELDS', 'Metadata fields must be an object');
  for (const [key, value] of Object.entries(fields)) {
    if (!EDITABLE.includes(key)) fail(400, 'FIELD_NOT_EDITABLE', 'Unsupported editable field: ' + key);
    if (key === 'tags' ? !Array.isArray(value) || value.some((item: unknown): boolean => typeof item !== 'string') : typeof value !== 'string') fail(400, 'INVALID_FIELDS', 'Invalid metadata value: ' + key);
  }
}
export function patchDocument(root: string, relative: string, patch: DocumentPatch): Mutation[] {
  const document: InternalDocument = readDocument(root, relative);
  if (typeof patch.expectedRevision !== 'string' || patch.expectedRevision !== document.revision) fail(409, 'REVISION_CONFLICT', 'Record changed; reload before saving');
  if (patch.content !== undefined && typeof patch.content !== 'string') fail(400, 'INVALID_CONTENT', 'Content must be text');
  validateFields(patch.fields || {});
  const changes: Map<string, Buffer> = new Map();
  const main: string = document.main || 'entity.yml';
  const metadata: Fields = document.main ? yamlObject(document.values.get(main)!.toString('utf8')) : {};
  const frontFields: Fields = { ...document.front.data };
  let body: string = patch.content ?? document.content;
  let bodyChanged: boolean = body !== document.content;
  let mainChanged: boolean = false;
  let frontChanged: boolean = false;
  for (const [key, value] of Object.entries(patch.fields || {})) {
    if (JSON.stringify(document.fields[key]) === JSON.stringify(value)) continue;
    if (key === 'title' && lastHeading(body)) { if (bodyChanged && lastHeading(body)!.title !== document.fields.title && lastHeading(body)!.title !== value) fail(409, 'AMBIGUOUS_METADATA', 'Title and the edited Markdown heading disagree'); body = replaceHeading(body, String(value)); bodyChanged = true; }
    else if (Object.prototype.hasOwnProperty.call(frontFields, key)) { frontFields[key] = value; frontChanged = true; }
    else { metadata[key] = value; mainChanged = true; }
  }
  if (mainChanged) { if (document.values.has(main) && !validUtf8(document.values.get(main)!)) fail(409, 'UNSUPPORTED_ENCODING', 'Normalize invalid UTF-8 metadata explicitly before editing'); changes.set(main, Buffer.from(safeDump(metadata))); }
  const original: Buffer = document.values.get('readme.md') || Buffer.alloc(0);
  if (bodyChanged || frontChanged) {
    if (!validUtf8(original)) fail(409, 'UNSUPPORTED_ENCODING', 'Normalize invalid UTF-8 Markdown explicitly before editing');
    const prefix: string = frontChanged ? (document.front.prefix.startsWith('\uFEFF') ? '\uFEFF' : '') + '---\n' + safeDump(frontFields) + '---\n' : document.front.prefix;
    const bytes: Buffer = Buffer.from(prefix + body); if (!bytes.equals(original)) changes.set('readme.md', bytes);
  }
  return [...changes].map(([file, bytes]: [string, Buffer]): Mutation => ({ file: contained(root, relative + '/' + file), bytes }));
}
