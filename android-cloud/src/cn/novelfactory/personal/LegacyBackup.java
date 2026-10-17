package cn.novelfactory.personal;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
/** Read-only export of old local books; never exports settings, keys or jobs. */
final class LegacyBackup implements AutoCloseable {
  final SQLiteDatabase db;
  LegacyBackup(Context c){db=SQLiteDatabase.openDatabase(c.getDatabasePath("novel-factory.sqlite").getPath(),null,SQLiteDatabase.OPEN_READONLY);}
  List<JSONObject> records(String kind,String parent)throws Exception{
    List<JSONObject> result=new ArrayList<>();String sql="SELECT id,kind,parent,data,revision FROM records WHERE owner=? AND kind=?"+(parent==null?"":" AND parent=?");String[] args=parent==null?new String[]{"android-personal",kind}:new String[]{"android-personal",kind,parent};
    try(Cursor rows=db.rawQuery(sql,args)){while(rows.moveToNext()){JSONObject x=new JSONObject(rows.getString(3));x.put("id",rows.getString(0)).put("kind",rows.getString(1)).put("parent",rows.getString(2)).put("revision",rows.getLong(4));result.add(x);}}return result;
  }
  byte[] export(JSONObject book)throws Exception{String id=book.getString("id");java.text.SimpleDateFormat date=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'",java.util.Locale.ROOT);date.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));JSONObject x=new JSONObject().put("format","novel-factory-backup-v1").put("book",book).put("exportedAt",date.format(new java.util.Date()));
    String[][] keys={{"chapters","chapter"},{"versions","version"},{"planVersions","planVersion"},{"audits","audit"},{"styleReferences","styleReference"},{"styleProfiles","styleProfile"},{"styleTasks","styleTask"}};
    for(String[] pair:keys)x.put(pair[0],new JSONArray(records(pair[1],id)));return x.toString().getBytes("UTF-8");
  }
  @Override public void close(){db.close();}
}
