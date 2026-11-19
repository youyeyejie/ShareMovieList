// Page-owned, accessible dialogs. A queue prevents an arriving error from
// replacing an unanswered permission confirmation.
let queue=Promise.resolve();
export function showMessage({title='提示',message,confirmText='知道了',cancelText='',danger=false}={}){
  const result=queue.then(()=>new Promise(resolve=>{
    const dialog=document.querySelector('#message-dialog');
    const confirm=document.querySelector('#message-confirm'),cancel=document.querySelector('#message-cancel');
    document.querySelector('#message-title').textContent=title;
    document.querySelector('#message-body').textContent=message;
    confirm.textContent=confirmText;confirm.classList.toggle('destructive',danger);
    cancel.hidden=!cancelText;cancel.textContent=cancelText||'取消';
    confirm.onclick=()=>dialog.close('confirm');cancel.onclick=()=>dialog.close('cancel');
    document.querySelector('#message-close').onclick=()=>dialog.close('cancel');
    dialog.returnValue='cancel';
    dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});
    dialog.showModal();
    (danger&&cancelText?cancel:confirm).focus();
  }));
  queue=result.catch(()=>false);return result;
}
export const ask=(title,message,confirmText='确定',danger=false)=>showMessage({title,message,confirmText,cancelText:'取消',danger});
