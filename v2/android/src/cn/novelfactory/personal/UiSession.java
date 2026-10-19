package cn.novelfactory.personal;

/** Request ownership for native pages. Polling can update data, never change routes. */
public final class UiSession {
 private long epoch=0,issued=0,accepted=0;
 public static final class Ticket {
  final long epoch,sequence;final String page,book;
  Ticket(long e,long s,String p,String b){epoch=e;sequence=s;page=p;book=b;}
 }
 public void leavePage(){epoch++;}
 public Ticket begin(String page,String book){return new Ticket(epoch,++issued,page,book);}
 public boolean currentPage(Ticket ticket,String page){return ticket.epoch==epoch&&ticket.page.equals(page);}
 public boolean current(Ticket ticket,String page,String book){return currentPage(ticket,page)&&ticket.book.equals(book);}
 public boolean accept(Ticket ticket,String book){if(!ticket.book.equals(book)||ticket.sequence<accepted)return false;accepted=ticket.sequence;return true;}
 public boolean pollAllowed(String page){return page.equals("作品");}
 public boolean render(Ticket ticket,String page,String book,boolean requested){return requested&&current(ticket,page,book);}
}
