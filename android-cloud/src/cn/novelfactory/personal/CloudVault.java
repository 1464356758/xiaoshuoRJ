package cn.novelfactory.personal;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;
final class CloudVault {
  static final String ALIAS="novel-cloud-control-v1";
  static SecretKey key()throws Exception{KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(!ks.containsAlias(ALIAS)){KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (SecretKey)ks.getKey(ALIAS,null);}
  static JSONObject read(Context c){try{SharedPreferences p=c.getSharedPreferences("cloud-profile",Context.MODE_PRIVATE);if(!p.contains("encrypted"))return null;Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(p.getString("iv",""),Base64.NO_WRAP)));return new JSONObject(new String(cipher.doFinal(Base64.decode(p.getString("encrypted",""),Base64.NO_WRAP)),"UTF-8"));}catch(Exception e){return null;}}
  static void save(Context c,JSONObject value)throws Exception{Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());if(!c.getSharedPreferences("cloud-profile",Context.MODE_PRIVATE).edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("encrypted",Base64.encodeToString(cipher.doFinal(value.toString().getBytes("UTF-8")),Base64.NO_WRAP)).commit())throw new IllegalStateException("连接凭证保存失败");}
  static void clear(Context c){c.getSharedPreferences("cloud-profile",Context.MODE_PRIVATE).edit().clear().commit();}
}
