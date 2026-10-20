package cn.aiworkspace.personal;
import android.app.*;
import android.content.*;
import android.os.*;

public final class ChatService extends Service {
 static final String CHANNEL="ai-replies";
 @Override public int onStartCommand(Intent intent,int flags,int startId){WorkspaceApp app=(WorkspaceApp)getApplication();if(intent==null){stopSelf();return START_NOT_STICKY;}if("stop".equals(intent.getAction())){app.engine.cancel();stopForeground(true);stopSelf();return START_NOT_STICKY;}
  NotificationManager nm=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);if(Build.VERSION.SDK_INT>=26)nm.createNotificationChannel(new NotificationChannel(CHANNEL,"AI回复生成",NotificationManager.IMPORTANCE_LOW));Intent open=new Intent(this,MainActivity.class);PendingIntent pi=PendingIntent.getActivity(this,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Intent stop=new Intent(this,ChatService.class).setAction("stop");PendingIntent cancel=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL):new Notification.Builder(this);builder.setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("AI 正在回复").setContentText("轻触返回对话；可停止生成").setContentIntent(pi).setOngoing(true).addAction(android.R.drawable.ic_media_pause,"停止",cancel);startForeground(20,builder.build());app.engine.run(intent.getStringExtra("requestId"),()->{stopForeground(true);stopSelf();});return START_NOT_STICKY;
 }
 @Override public void onTimeout(int startId,int type){((WorkspaceApp)getApplication()).engine.cancel();stopForeground(true);stopSelf();}
 @Override public IBinder onBind(Intent i){return null;}
}
