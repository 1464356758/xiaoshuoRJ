package cn.aiworkspace.personal;
import android.os.*;
import org.json.*;
import java.util.concurrent.*;

final class ChatEngine {
 interface Observer{void changed(String chatId,boolean finished);}
 private final Store store;private final ExecutorService io=Executors.newSingleThreadExecutor();private final ScheduledExecutorService clock=Executors.newSingleThreadScheduledExecutor();private final Handler main=new Handler(Looper.getMainLooper());
 volatile Observer observer;private volatile String current="";private volatile ApiClient client;private volatile ApiProtocol.Output output;
 ChatEngine(Store store){this.store=store;}
 boolean executing(){return !current.isEmpty();}
 void notifyUi(String chat,boolean finished){main.post(()->{Observer o=observer;if(o!=null)o.changed(chat,finished);});}
 synchronized void run(String id,Runnable completed){if(!current.isEmpty())return;JSONObject request=store.request(id);if(request==null||!request.optString("status").equals("queued")){completed.run();return;}current=id;io.execute(()->{String chat=J.str(request,"chatId");ScheduledFuture<?> deadline=null;ApiClient c=new ApiClient();client=c;output=new ApiProtocol.Output();try{JSONObject d=request.getJSONObject("data"),p=d.getJSONObject("provider");String key=KeyVault.open(J.str(p,"keyCipher"));J.require(!key.isEmpty(),"密钥为空，请在 API 设置重新填写");if(!store.begin(id))return;notifyUi(chat,false);deadline=clock.schedule(()->{store.finish(id,"interrupted",output,"等待超过设定时限，部分回答保留；没有自动重试。");c.cancel();notifyUi(chat,true);},p.optInt("timeout",180),TimeUnit.SECONDS);
    final long[] checkpoint={0};ApiProtocol.Output result=c.generate(p,d.getString("model"),key,d.getJSONObject("payload"),part->{output=part;if(System.currentTimeMillis()-checkpoint[0]>200){checkpoint[0]=System.currentTimeMillis();store.partial(id,part);notifyUi(chat,false);}});output=result;store.finish(id,result.complete()?"done":"incomplete",result,result.complete()?"":"服务商结束原因："+result.finish+"。部分回答保留，没有自动补写。");
   }catch(Exception e){store.finish(id,"error",output,e.getMessage()==null?"请求未完成；没有自动重试。":e.getMessage());}
   finally{if(deadline!=null)deadline.cancel(false);client=null;current="";notifyUi(chat,true);main.post(completed);}
  });}
 void cancel(){JSONObject r=store.active();if(r==null)return;String id=J.str(r,"id");if(id.equals(current)&&output!=null)store.partial(id,output);store.stop(id);ApiClient c=client;if(id.equals(current)&&c!=null)c.cancel();notifyUi(J.str(r,"chatId"),true);}
}
