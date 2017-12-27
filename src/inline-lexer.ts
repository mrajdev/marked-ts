/**
 * @license
 * 
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 * 
 * Copyright (c) 2018, Костя Третяк. (MIT Licensed)
 * https://github.com/KostyaTretyak/marked-ts
 */

import { ExtendRegexp } from './extend-regexp';
import { Renderer } from './renderer';
import { Marked } from './marked';
import {
  InlineGrammar,
  MarkedOptions,
  Links,
  Link,
  InlineGfm,
  InlineBreaks,
  InlinePedantic,
  InlineRuleFunction
} from './interfaces';


/**
 * Inline Lexer & Compiler.
 * 
 * @todo Remove from constructor reference to current class.
 */
export class InlineLexer
{
  protected static inline: InlineGrammar;
  /**
   * Pedantic Inline Grammar.
   */
  protected static inlinePedantic: InlinePedantic;
  /**
   * GFM Inline Grammar
   */
  protected static inlineGfm: InlineGfm;
  /**
   * GFM + Line Breaks Inline Grammar.
   */
  protected static inlineBreaks: InlineBreaks;
  protected out = '';
  protected nextPart = '';
  protected isMatch: boolean;
  protected links: Links;
  protected rules: InlineGrammar;
  protected options: MarkedOptions;
  protected renderer: Renderer;
  protected inLink: boolean;

  constructor(links: Links, options?: MarkedOptions, renderer?: Renderer)
  {
    this.options = options || Marked.defaults;
    this.renderer = renderer || this.options.renderer || new Renderer(this.options);
    this.links = links;

    if(!this.links)
      throw new Error(`InlineLexer requires 'links' parameter.`);

    if(this.options.gfm)
    {
      if(this.options.breaks)
      {
        this.rules = InlineLexer.getInlineBreaks();
      }
      else
      {
        this.rules = InlineLexer.getInlineGfm();
      }
    }
    else if(this.options.pedantic)
    {
      this.rules = InlineLexer.getInlinePedantic()
    }
    else
    {
      this.rules = InlineLexer.getInline()
    }
  }

  protected static getInline(): InlineGrammar
  {
    if(this.inline)
      return this.inline;

    /**
     * Inline-Level Grammar.
     */
    const inline: InlineGrammar =
    {
      escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
      autolink: /^<([^ <>]+(@|:\/)[^ <>]+)>/,
      tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^<'">])*?>/,
      link: /^!?\[(inside)\]\(href\)/,
      reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
      nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
      strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
      em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
      code: /^(`+)([\s\S]*?[^`])\1(?!`)/,
      br: /^ {2,}\n(?!\s*$)/,
      text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/,
      _inside: /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/,
      _href: /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/,
    };

    inline.link = new ExtendRegexp(inline.link)
    .setGroup('inside', inline._inside)
    .setGroup('href', inline._href)
    .getRegexp();

    inline.reflink = new ExtendRegexp(inline.reflink)
    .setGroup('inside', inline._inside)
    .getRegexp();

    return this.inline = inline;
  }

  protected static getInlinePedantic(): InlinePedantic
  {
    if(this.inlinePedantic)
      return this.inlinePedantic;

    return this.inlinePedantic =
    {
      ...this.getInline(),
      ...{
        strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
        em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
      }
    };
  }

  protected static getInlineGfm(): InlineGfm
  {
    if(this.inlineGfm)
      return this.inlineGfm;
    
    const inline = this.getInline();

    const escape = new ExtendRegexp(inline.escape)
    .setGroup('])', '~|])')
    .getRegexp();

    const text = new ExtendRegexp(inline.text)
    .setGroup(']|', '~]|')
    .setGroup('|', '|https?://|')
    .getRegexp();

    return this.inlineGfm =
    {
      ...inline,
      ...{
        escape: escape,
        url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
        del: /^~~(?=\S)([\s\S]*?\S)~~/,
        text: text
      }
    };
  }

  protected static getInlineBreaks(): InlineBreaks
  {
    if(this.inlineBreaks)
      return this.inlineBreaks;
    
    const inline = this.getInlineGfm();
    const gfm = this.getInlineGfm();

    return this.inlineBreaks =
    {
      ...gfm,
      ...{
        br: new ExtendRegexp(inline.br).setGroup('{2,}', '*').getRegexp(),
        text: new ExtendRegexp(gfm.text).setGroup('{2,}', '*').getRegexp()
      }
    };
  }

  /**
   * Static Lexing/Compiling Method.
   */
  static output(src: string, links: Links, options: MarkedOptions): string
  {
    const inlineLexer = new this(links, options);
    return inlineLexer.output(src);
  }

  protected ruleFunctions: InlineRuleFunction[] =
  [
    // escape
    this.checkEscape.bind(this),
    // autolink
    this.checkAutolink.bind(this),
    // url (gfm)
    this.checkUrl.bind(this),
    // tag
    this.checkTag.bind(this),
    // link
    this.checkLink.bind(this),
    // reflink, nolink
    this.checkReflink.bind(this),
    // strong
    this.checkStrong.bind(this),
    // em
    this.checkEm.bind(this),
    // code
    this.checkCode.bind(this),
    // br
    this.checkBr.bind(this),
    // del (gfm)
    this.checkDel.bind(this),
    // text
    this.checkText.bind(this),
  ];

  /**
   * Lexing/Compiling.
   */
  output(nextPart: string): string
  {
    this.nextPart = nextPart;

    nextPart:
    while(this.nextPart)
    {
      for(let i = 0; i < this.ruleFunctions.length; i++)
      {
        this.ruleFunctions[i]();

        if(this.isMatch)
        {
          this.isMatch = false;
          continue nextPart;
        }
      }

      if(this.nextPart)
        throw new Error('Infinite loop on byte: ' + this.nextPart.charCodeAt(0));
    }

    const out = this.out;
    this.out = '';
    return out;
  }

  protected checkEscape(): void
  {
    const execArr = this.rules.escape.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += execArr[1];
  }

  protected checkAutolink(): void
  {
    const execArr = this.rules.autolink.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    let text: string, href: string;
    this.nextPart = this.nextPart.substring(execArr[0].length);

    if(execArr[2] === '@')
    {
      text = this.options.escape
      (
        execArr[1].charAt(6) === ':'
        ? this.mangle(execArr[1].substring(7))
        : this.mangle(execArr[1])
      );
      href = this.mangle('mailto:') + text;
    }
    else
    {
      text = this.options.escape(execArr[1]);
      href = text;
    }

    this.out += this.renderer.link(href, null, text);
  }

  protected checkUrl(): void
  {
    let execArr: RegExpExecArray;

    if
    (
      this.inLink
      || !this.isInlineGfm(this.rules)
      || !(execArr = this.rules.url.exec(this.nextPart))
    )
    {
      return;
    }

    this.isMatch = true;
    let text: string, href: string;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    text = this.options.escape(execArr[1]);
    href = text;
    this.out += this.renderer.link(href, null, text);
  }

  protected checkTag(): void
  {
    const execArr = this.rules.tag.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;

    if(!this.inLink && /^<a /i.test(execArr[0]))
    {
      this.inLink = true;
    }
    else if(this.inLink && /^<\/a>/i.test(execArr[0]))
    {
      this.inLink = false;
    }

    this.nextPart = this.nextPart.substring(execArr[0].length);

    this.out += this.options.sanitize
      ? this.options.sanitizer
        ? this.options.sanitizer(execArr[0])
        : this.options.escape(execArr[0])
      : execArr[0];
  }

  protected checkLink(): void
  {
    const execArr = this.rules.link.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.inLink = true;

    this.out += this.outputLink(execArr, {
      href: execArr[2],
      title: execArr[3]
    });

    this.inLink = false;
  }

  protected checkReflink(): void
  {
    let execArr: RegExpExecArray;
    if
    (
      !(execArr = this.rules.reflink.exec(this.nextPart))
      && !(execArr = this.rules.nolink.exec(this.nextPart))
    )
    {
      return;
    }

    this.isMatch = true;

    this.nextPart = this.nextPart.substring(execArr[0].length);
    const keyLink = (execArr[2] || execArr[1]).replace(/\s+/g, ' ');
    const link = this.links[keyLink.toLowerCase()];

    if(!link || !link.href)
    {
      this.out += execArr[0].charAt(0);
      this.nextPart = execArr[0].substring(1) + this.nextPart;
      return;
    }

    this.inLink = true;
    this.out += this.outputLink(execArr, link);
    this.inLink = false;
  }

  protected checkStrong(): void
  {
    const execArr = this.rules.strong.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += this.renderer.strong(InlineLexer.output(execArr[2] || execArr[1], this.links, this.options));
  }

  protected checkEm(): void
  {
    const execArr = this.rules.em.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += this.renderer.em(InlineLexer.output(execArr[2] || execArr[1], this.links, this.options));
  }

  protected checkCode(): void
  {
    const execArr = this.rules.code.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += this.renderer.codespan(this.options.escape(execArr[2].trim(), true));
  }

  protected checkBr(): void
  {
    const execArr = this.rules.br.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += this.renderer.br();
  }

  protected checkDel(): void
  {
    let execArr: RegExpExecArray;

    if
    (
      !this.isInlineGfm(this.rules)
      || !(execArr = this.rules.del.exec(this.nextPart)))
    {
      return;
    }

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += this.renderer.del(InlineLexer.output(execArr[1], this.links, this.options));
  }

  protected checkText(): void
  {
    const execArr = this.rules.text.exec(this.nextPart);

    if(!execArr)
      return;

    this.isMatch = true;
    this.nextPart = this.nextPart.substring(execArr[0].length);
    this.out += this.renderer.text( this.options.escape(this.smartypants(execArr[0])) );
  }

  /**
   * Compile Link.
   */
  outputLink(execArr: RegExpExecArray, link: Link)
  {
    const href = this.options.escape(link.href)
      ,title = link.title ? this.options.escape(link.title) : null;

    return execArr[0].charAt(0) !== '!'
      ? this.renderer.link(href, title, InlineLexer.output(execArr[1], this.links, this.options))
      : this.renderer.image(href, title, this.options.escape(execArr[1]));
  }

  /**
   * Smartypants Transformations.
   */
  smartypants(text: string)
  {
    if(!this.options.smartypants)
      return text;

    return text
    // em-dashes
    .replace(/---/g, '\u2014')
    // en-dashes
    .replace(/--/g, '\u2013')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026');
  }

  /**
   * Mangle Links.
   */
  mangle(text: string)
  {
    if(!this.options.mangle)
      return text;

    let out = '', length = text.length;

    for(let i = 0; i < length; i++)
    {
      let str: string;

      if(Math.random() > 0.5)
      {
        str = 'x' + text.charCodeAt(i).toString(16);
      }

      out += '&#' + str + ';';
    }

    return out;
  }

  protected isInlineGfm(rules: InlineGrammar | InlineBreaks | InlineGfm | InlineGrammar): rules is InlineGfm
  {
    return (<InlineGfm>rules).url !== undefined;
  }
}
