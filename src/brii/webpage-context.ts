import {visible} from './context-text';
export const PAGE_CONTEXT_LIMIT=8000;
const excluded='nav,aside,footer,form,script,style,template,noscript,svg,input,textarea,select,button,[role="navigation"],[role="dialog"],[role="textbox"],[contenteditable]:not([contenteditable="false"]),[data-brii-status]';
// Walk rendered text, stopping at the budget. Never read editor values or hidden DOM.
function text(root:HTMLElement|undefined|null,limit:number):string{
 let remaining=limit;
 const read=(node:Node):string=>{
  if(remaining<=0)return '';
  if(node.nodeType===Node.TEXT_NODE){const value=(node.textContent||'').slice(0,remaining);remaining-=value.length;return value;}
  if(!(node instanceof HTMLElement)||!visible(node)||node.matches(excluded))return '';
  if(node.tagName==='BR'){remaining--;return '\n';}
  let value='';for(const child of node.childNodes){if(remaining<=0)break;value+=read(child);}
  if(remaining>0&&getComputedStyle(node).display!=='inline'){value+='\n';remaining--;}
  return value;
 };
 return root?read(root).replace(/\n{3,}/g,'\n\n').trim():'';
}
function one(scope:ParentNode,selector:string){return [...scope.querySelectorAll<HTMLElement>(selector)].filter(visible);}
export function webpageContext(editor:HTMLElement):string{
 if(location.origin==='https://mail.google.com')return '';
 const chunks:string[]=[];
 const add=(label:string,element:HTMLElement|null|undefined,limit:number)=>{const value=text(element,limit);if(value)chunks.push(label+':\n'+value);};
 if(location.hostname==='news.ycombinator.com'){
  const rows=one(document,'tr.comtr');let target=editor.closest<HTMLElement>('tr.comtr');
  if(!target&&(location.pathname==='/reply'||editor.closest('.comment-tree')))
   target=rows.filter(row=>!!(row.compareDocumentPosition(editor)&Node.DOCUMENT_POSITION_FOLLOWING)).at(-1)||null;
  if(target){
   add('Comment being replied to',target.querySelector<HTMLElement>('.commtext'),3200);
   let indent=Number(target.querySelector('.ind img')?.getAttribute('width')||0);
   const ancestors:HTMLElement[]=[];
   for(let index=rows.indexOf(target)-1;index>=0&&ancestors.length<4;index--){const row=rows[index],width=Number(row.querySelector('.ind img')?.getAttribute('width')||0);if(width<indent){ancestors.push(row);indent=width;}}
   for(const row of ancestors)add('Ancestor comment (nearest first)',row.querySelector<HTMLElement>('.commtext'),900);
  }
  add('Post title',document.querySelector<HTMLElement>('.fatitem .titleline'),400);
  add('Post text',document.querySelector<HTMLElement>('.fatitem .toptext'),2000);
 }else if(/(^|\.)reddit\.com$/.test(location.hostname)){
  const selector='shreddit-comment,.thing.comment,[data-testid="comment"]';
  let comment=editor.closest<HTMLElement>(selector);
  for(let depth=0;comment&&depth<5;depth++){
   const body=[...comment.querySelectorAll<HTMLElement>('[slot="comment"],.usertext-body .md,[data-testid="comment-body"]')].find(node=>node.closest(selector)===comment);
   add(depth===0?'Comment being replied to':'Ancestor comment (nearest first)',body,depth===0?3200:900);
   comment=comment.parentElement?.closest<HTMLElement>(selector)||null;
  }
  const scope=editor.closest<HTMLElement>('main,[role="main"]')||document;
  const posts=one(scope,'shreddit-post,.thing.link');
  const post=editor.closest<HTMLElement>('shreddit-post,.thing.link')||(location.pathname.includes('/comments/')&&posts.length===1?posts[0]:undefined);
  if(post){add('Post title',post.querySelector<HTMLElement>('h1,[slot="title"],a.title'),400);const body=[...post.querySelectorAll<HTMLElement>('[slot="text-body"],.usertext-body .md')].find(node=>!node.closest(selector));add('Post text',body,2400);}
 }else{
  // Article/main only: no whole-body fallback that could scoop up inboxes or sidebars.
  const article=editor.closest<HTMLElement>('article'),main=editor.closest<HTMLElement>('main,[role="main"]');
  const articles=one(main||document,'article'),mains=one(document,'main,[role="main"]');
  const root=article||(articles.length===1?articles[0]:main||(mains.length===1?mains[0]:undefined));
  add('Visible article/page text',root,7400);
 }
 if(!chunks.length)return '';
 const title=document.title.trim().slice(0,240);
 return ((title?'Page title: '+title+'\n\n':'')+chunks.join('\n\n')).slice(0,PAGE_CONTEXT_LIMIT);
}
