package cn.novelfactory.personal;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.sqlite.SQLiteStatement;
import org.json.JSONArray;
import org.json.JSONObject;

/** Every write + its compatibility projections are one transaction. No JSON1 dependency. */
final class LocalDatabase extends SQLiteOpenHelper {
  private static final String EXTRA=",nf_lease_until INTEGER,nf_spend_enabled INTEGER,nf_chapter INTEGER,nf_status TEXT";
  LocalDatabase(Context c){super(c,"novel-factory.sqlite",null,1);setWriteAheadLoggingEnabled(true);}
  @Override public void onCreate(SQLiteDatabase db){
    db.execSQL("CREATE TABLE records(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,kind TEXT NOT NULL,parent TEXT NOT NULL DEFAULT '',data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated INTEGER NOT NULL"+EXTRA+")");
    db.execSQL("CREATE INDEX idx_records_owner_kind_parent ON records(owner,kind,parent)");
    db.execSQL("CREATE TABLE calls(id TEXT PRIMARY KEY NOT NULL,owner TEXT NOT NULL,book TEXT NOT NULL,month TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL"+EXTRA+")");
    db.execSQL("CREATE INDEX idx_calls_owner_month ON calls(owner,month)");
    db.execSQL("CREATE INDEX idx_calls_owner_book ON calls(owner,book)");
  }
  @Override public void onUpgrade(SQLiteDatabase db,int from,int to){throw new IllegalStateException("需升级数据库迁移程序");}
  private static void bind(SQLiteStatement q,JSONArray args)throws Exception{
    for(int i=0;i<args.length();i++){Object v=args.get(i);int n=i+1;
      if(v==JSONObject.NULL)q.bindNull(n);else if(v instanceof Float||v instanceof Double)q.bindDouble(n,((Number)v).doubleValue());
      else if(v instanceof Number)q.bindLong(n,((Number)v).longValue());else if(v instanceof Boolean)q.bindLong(n,(Boolean)v?1:0);else q.bindString(n,v.toString());
    }
  }
  synchronized String execute(String raw){
    try{
      JSONObject x=new JSONObject(raw);String sql=x.getString("sql"),mode=x.getString("mode");JSONArray args=x.getJSONArray("args");SQLiteDatabase db=getWritableDatabase();
      if("all".equals(mode)){
        if(!sql.startsWith("SELECT "))throw new IllegalArgumentException("只允许读取查询");
        String[] values=new String[args.length()];for(int i=0;i<values.length;i++)values[i]=args.isNull(i)?null:String.valueOf(args.get(i));
        JSONArray rows=new JSONArray();try(Cursor c=db.rawQuery(sql,values)){while(c.moveToNext()){JSONObject row=new JSONObject();for(int i=0;i<c.getColumnCount();i++){
          String name=c.getColumnName(i);if(name.startsWith("nf_"))continue;
          int t=c.getType(i);row.put(name,t==Cursor.FIELD_TYPE_NULL?JSONObject.NULL:t==Cursor.FIELD_TYPE_INTEGER?c.getLong(i):t==Cursor.FIELD_TYPE_FLOAT?c.getDouble(i):c.getString(i));
        }rows.put(row);}}return new JSONObject().put("rows",rows).toString();
      }
      if(!"run".equals(mode)||!(sql.startsWith("INSERT ")||sql.startsWith("UPDATE ")||sql.startsWith("DELETE ")))throw new IllegalArgumentException("不支持的数据库操作");
      db.beginTransaction();int changes;
      try{
        try(SQLiteStatement q=db.compileStatement(sql)){bind(q,args);q.execute();}
        try(Cursor c=db.rawQuery("SELECT changes()",null)){c.moveToFirst();changes=c.getInt(0);}
        if(changes>0&&!x.isNull("after")){
          JSONObject p=x.getJSONObject("after");String table=p.getString("table");if(!"records".equals(table)&&!"calls".equals(table))throw new IllegalArgumentException("无效数据表");
          JSONArray values=p.getJSONArray("values");values.put(p.getString("id"));
          try(SQLiteStatement q=db.compileStatement("UPDATE "+table+" SET nf_lease_until=?,nf_spend_enabled=?,nf_chapter=?,nf_status=? WHERE id=?")){bind(q,values);q.executeUpdateDelete();}
        }
        db.setTransactionSuccessful();
      }finally{db.endTransaction();}
      return new JSONObject().put("changes",changes).toString();
    }catch(Exception e){try{return new JSONObject().put("error","本机数据库操作失败："+e.getClass().getSimpleName()).toString();}catch(Exception ignored){return "{\"error\":\"本机数据库操作失败\"}";}}
  }
}
