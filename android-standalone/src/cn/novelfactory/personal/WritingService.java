package cn.novelfactory.personal;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.SystemClock;

/** User-started, bounded foreground dataSync session. No reboot/kill auto restart. */
public final class WritingService extends Service {
  static final String CHANNEL="novel-writing",PAUSE="cn.novelfactory.personal.PAUSE";static final int ID=10;
  static final long SESSION_LIMIT=5L*60*60*1000;
  private final Handler handler=new Handler();private AppRuntime runtime;private PowerManager.WakeLock wake;private long started;
  private final Runnable tick=new Runnable(){@Override public void run(){
    if(runtime==null||!runtime.running){stopSelf();return;}
    if(SystemClock.elapsedRealtime()-started>=SESSION_LIMIT){runtime.pause("本次已运行约5小时，请检查后再次启动");stopSelf();return;}
    runtime.tick();handler.postDelayed(this,1500);
  }};
  @Override public void onCreate(){super.onCreate();runtime=AppRuntime.get(this);if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CHANNEL,"小说自动创作",NotificationManager.IMPORTANCE_LOW);c.setDescription("显示本机自动任务并提供暂停");getSystemService(NotificationManager.class).createNotificationChannel(c);}}
  static void refresh(Context c){((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID,notification(c));}
  private static Notification notification(Context c){
    AppRuntime r=AppRuntime.get(c);int flags=PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE;
    PendingIntent open=PendingIntent.getActivity(c,1,new Intent(c,MainActivity.class),flags),pause=PendingIntent.getService(c,2,new Intent(c,WritingService.class).setAction(PAUSE),flags);
    Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(c,CHANNEL):new Notification.Builder(c);
    return b.setSmallIcon(R.drawable.ic_launcher).setContentTitle("小说工厂 · 本机自动执行").setContentText(r.message).setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).addAction(new Notification.Action.Builder(R.drawable.ic_launcher,"暂停",pause).build()).build();
  }
  @Override public int onStartCommand(Intent intent,int flags,int id){
    if(intent!=null&&PAUSE.equals(intent.getAction())){runtime.pause("已从通知栏暂停");stopSelf();return START_NOT_STICKY;}
    if(runtime.running)return START_NOT_STICKY;
    try{
      if(Build.VERSION.SDK_INT>=29)startForeground(ID,notification(this),ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);else startForeground(ID,notification(this));
      runtime.running=true;runtime.message="正在检查本机任务";started=SystemClock.elapsedRealtime();
      PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);wake=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"NovelFactory:writing");wake.acquire(SESSION_LIMIT+30000);
      handler.post(tick);
    }catch(Exception e){runtime.pause("后台服务启动失败，请回到App检查通知和电量设置");stopSelf();}
    return START_NOT_STICKY;
  }
  @Override public void onTimeout(int startId,int fgsType){runtime.pause("安卓后台时限已到，检查点保留；请打开App后继续");stopSelf();}
  @Override public void onDestroy(){handler.removeCallbacks(tick);if(runtime!=null)runtime.running=false;if(wake!=null&&wake.isHeld())wake.release();stopForeground(true);super.onDestroy();}
  @Override public IBinder onBind(Intent intent){return null;}
}
