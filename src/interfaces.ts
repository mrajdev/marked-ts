/**
 * @license
 * 
 * Copyright (c) 2018, Костя Третяк. (MIT Licensed)
 * https://github.com/KostyaTretyak/marked-ts
 */

import { Renderer } from './renderer';
import { escape, unescape } from './helpers';

export type Obj = {[key: string]: any};

export interface BlockGrammar
{
  newline: RegExp,
  code: RegExp,
  hr: RegExp,
  heading: RegExp,
  lheading: RegExp,
  blockquote: RegExp,
  list: RegExp,
  html: RegExp,
  def: RegExp,
  paragraph: RegExp,
  text: RegExp,
  bullet: RegExp,
  /**
   * List item (<li>).
   */
  item: RegExp,
  _tag: string
}

export interface BlockGfm extends BlockGrammar
{
  fences: RegExp
}

export interface BlockTables extends BlockGfm
{
  nptable: RegExp,
  table: RegExp
}

export interface Link
{
  href: string,
  title: string
}

export interface Links
{
  [key: string]: Link
}

export enum TokenType
{
  space = 1
  ,code
  ,heading
  ,table
  ,hr
  ,blockquoteStart
  ,blockquoteEnd
  ,listStart
  ,listEnd
  ,looseItemStart
  ,looseItemEnd
  ,listItemStart
  ,listItemEnd
  ,paragraph
  ,html
  ,text
}

export type Align = 'center' | 'left' | 'right';

export interface Token
{
  type?: TokenType;
  text?: string;
  lang?: string;
  depth?: number;
  header?: string[];
  align?: Align[];
  cells?: string[][];
  ordered?: boolean;
  pre?: boolean;
  escaped?: boolean;
}

export interface InlineGrammar
{
  escape: RegExp,
  autolink: RegExp,
  tag: RegExp,
  link: RegExp,
  reflink: RegExp,
  nolink: RegExp,
  strong: RegExp,
  em: RegExp,
  code: RegExp,
  br: RegExp,
  text: RegExp,
  _inside: RegExp,
  _href: RegExp
}

export interface InlinePedantic extends InlineGrammar
{
  
}

/**
 * GFM Inline Grammar
 */
export interface InlineGfm extends InlineGrammar
{
  url: RegExp,
  del: RegExp,
}

export interface InlineBreaks extends InlineGfm
{
  
}

export type ParseCallback<T=string> = (err: Error, output?: string) => T;

export interface HighlightOverloading
{
  fn(code: string, lang?: string): string;
  fn<T>(code: string, lang?: string, callback?: ParseCallback<T>): T;
}

export type HighlightType = HighlightOverloading['fn'];

export class MarkedOptions
{
  gfm?: boolean = true;
  tables?: boolean = true;
  breaks?: boolean = false;
  pedantic?: boolean = false;
  sanitize?: boolean = false;
  sanitizer?: (text: string) => string;
  mangle?: boolean = true;
  smartLists?: boolean = false;
  silent?: boolean = false;
  /**
   * @param code The section of code to pass to the highlighter.
   * @param lang The programming language specified in the code block.
   * @param callback The callback function to call when using an async highlighter.
   */
  highlight?: HighlightType;
  langPrefix?: string = 'lang-';
  smartypants?: boolean = false;
  headerPrefix?: string = '';
  /**
   * An object containing functions to render tokens to HTML. Default: `new Renderer()`
   */
  renderer?: Renderer;
  /**
   * Self-close the tags for void elements (&lt;br/&gt;, &lt;img/&gt;, etc.)
   * with a "/" as required by XHTML.
   */
  xhtml?: boolean = false;
  /**
   * The function that will be using to escape HTML entities.
   * By default using inner helper.
   */
  escape?: (html: string, encode?: boolean) => string = escape;
  /**
   * The function that will be using to unescape HTML entities.
   * By default using inner helper.
   */
  unescape?: (html: string) => string = unescape;
}

export interface LexerReturns
{
  tokens: Token[],
  links: Links
}

export interface Replacements
{
  [key: string]: string;
}

export type BlockRuleFunction = (top?: boolean, isBlockQuote?: boolean) => void;
export type InlineRuleFunction = (top?: boolean, isBlockQuote?: boolean) => void;
