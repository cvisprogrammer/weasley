import type {GmailThread} from './types';
const message=(id:string,from:string,text:string,date:number)=>({id,internalDate:String(date),payload:{mimeType:'text/plain',headers:[{name:'From',value:from},{name:'To',value:'you@example.test'},{name:'Subject',value:id.startsWith('teacher')?'Parent meeting':id.startsWith('news')?'School weekly newsletter':'Lunch plans'}],body:{data:btoa(text)}}});
export const sampleAccount='you@example.test';
export const samples:GmailThread[]=[
 {id:'teacher1',messages:[message('teacher-msg','Teacher <teacher@school.test>','Could you reply to confirm whether Friday at noon works for our parent meeting?',100)]},
 {id:'news1',messages:[message('news-msg','School newsletter <news@school.test>','Our school fair is next weekend. Ready for a fun day? Read more on the school website. To unsubscribe, reply STOP.',200)]},
 {id:'lunch1',messages:[message('lunch-request','Friend <friend@example.test>','Are you free for lunch on Saturday?',300),message('lunch-reply','You <you@example.test>','Yes, Saturday works for me.',400)]}
];
