package cn.aiworkspace.personal;
import android.app.Application;
public final class WorkspaceApp extends Application {
 Store store;ChatEngine engine;
 @Override public void onCreate(){super.onCreate();store=new Store(this);engine=new ChatEngine(store);}
}
