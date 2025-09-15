import { Firestore } from '@google-cloud/firestore';

export const db=new Firestore();

export type NoteEntry={canonicalOwner:string; title:string; content:string; ts:number; dateKey:string; tags?:string[]};
export type FileIndexEntry={canonicalOwner:string; kind:string; driveFileId:string; name:string; webViewLink?:string; dateKey:string; appProperties?:Record<string,string>; ts:number};

// Firestore error handler for missing indexes
export function handleFirestoreError(err: any): void {
  if (err.code === 9 || err.message?.includes('requires an index')) { // Firestore FAILED_PRECONDITION
    console.error('⚠️ Firestore index missing. Create it here:', err.message);
    // Extract the index creation URL if present
    const match = err.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
    if (match) {
      console.error('🔗 Direct link:', match[0]);
    }
  }
}
