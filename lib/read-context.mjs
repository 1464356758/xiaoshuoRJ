// Keep a late read for another book from replacing the current workspace.
export function createReadContext() {
  let selected='',sequence=0;
  return {
    select(id){selected=id||'';sequence++;},
    begin(id){
      if(id&&selected&&id!==selected)return null;
      return {id,sequence:++sequence};
    },
    current(ticket){return !!ticket&&ticket.sequence===sequence&&(!ticket.id||!selected||ticket.id===selected);},
    accept(ticket,id){if(!this.current(ticket))return false;selected=id||'';return true;}
  };
}
