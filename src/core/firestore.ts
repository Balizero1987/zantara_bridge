import { Firestore } from '@google-cloud/firestore';
export const db=new Firestore();
export type NoteEntry={canonicalOwner:string; title:string; content:string; ts:number; dateKey:string; tags?:string[]};
export type FileIndexEntry={canonicalOwner:string; kind:string; driveFileId:string; name:string; webViewLink?:string; dateKey:string; appProperties?:Record<string,string>; ts:number};
