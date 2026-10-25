export interface MimePart { mimeType?:string; filename?:string; headers?:{name:string;value:string}[]; body?:{data?:string;size?:number;attachmentId?:string}; parts?:MimePart[]; }
export interface GmailMessage {id:string; internalDate?:string;labelIds?:string[];payload?:MimePart;}
export interface GmailThread {id:string;messages?:GmailMessage[];}
export interface MailPacket {self:string[]; latest:{id:string;from:string;to:string;cc:string;subject:string;body:string}; history:{from:string;body:string}[];incomplete:boolean;historyIncomplete?:boolean;}
export type Verdict='reply_needed'|'no_reply_needed'|'uncertain';
export interface Decision {verdict:Verdict;evidence:string;reason:string;}
export interface MailRow extends Decision {threadId:string;messageId:string;subject:string;from:string;checkedAt:number;sample?:boolean;}
export interface BadgeEntry {threadId:string;messageId:string;evidence:string;checkedAt:number;}
export interface BadgeCache {account:string;entries:BadgeEntry[];}
export const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export const MAIL_ORIGINS=['https://gmail.googleapis.com/*','https://oauth2.googleapis.com/*','https://mail.google.com/*'];
export const BADGE_TTL=15*60*1000;
