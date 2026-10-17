package cn.novelfactory.personal;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Exportable runtime key is wrapped by a non-exportable Android Keystore key. */
final class DeviceVault {
  private static final String ALIAS="novel-factory-device-v1";
  static synchronized String runtimeKey(Context context)throws Exception{
    SharedPreferences p=context.getSharedPreferences("novel-vault",Context.MODE_PRIVATE);KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
    if(!ks.containsAlias(ALIAS)){
      if(p.contains("wrapped"))throw new IllegalStateException("设备保险箱不可用，请保留原数据");
      KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();
    }
    SecretKey master=(SecretKey)ks.getKey(ALIAS,null);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
    if(p.contains("wrapped")){
      cipher.init(Cipher.DECRYPT_MODE,master,new GCMParameterSpec(128,Base64.decode(p.getString("iv",""),Base64.NO_WRAP)));
      return Base64.encodeToString(cipher.doFinal(Base64.decode(p.getString("wrapped",""),Base64.NO_WRAP)),Base64.NO_WRAP);
    }
    byte[] raw=new byte[32];new SecureRandom().nextBytes(raw);cipher.init(Cipher.ENCRYPT_MODE,master);
    if(!p.edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).putString("wrapped",Base64.encodeToString(cipher.doFinal(raw),Base64.NO_WRAP)).commit())throw new IllegalStateException("无法保存设备保险箱");
    return Base64.encodeToString(raw,Base64.NO_WRAP);
  }
}
