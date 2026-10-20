package cn.aiworkspace.personal;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.GradientDrawable;
import android.text.*;
import android.text.style.*;
import android.text.method.*;
import android.widget.*;
import java.util.regex.*;

final class Markdown {
 static void render(LinearLayout parent,String raw,int ink,int muted,int surface){parent.removeAllViews();String[] blocks=raw.split("```",-1);if(blocks.length>160)blocks=new String[]{raw};for(int i=0;i<blocks.length;i++){String part=blocks[i];if(part.isEmpty())continue;if(i%2==1){int first=part.indexOf('\n');String lang=first>=0?part.substring(0,first).trim():"code",code=first>=0?part.substring(first+1):part;LinearLayout card=new LinearLayout(parent.getContext());card.setOrientation(1);card.setPadding(14,10,14,12);GradientDrawable bg=new GradientDrawable();bg.setColor(surface);bg.setCornerRadius(18);card.setBackground(bg);TextView copy=new TextView(parent.getContext());copy.setText((lang.isEmpty()?"code":lang)+"    复制代码");copy.setTextSize(12);copy.setTextColor(muted);copy.setPadding(0,0,0,12);copy.setOnClickListener(v->{android.content.ClipboardManager cm=(android.content.ClipboardManager)v.getContext().getSystemService(Context.CLIPBOARD_SERVICE);cm.setPrimaryClip(ClipData.newPlainText("代码",code));Toast.makeText(v.getContext(),"已复制代码",Toast.LENGTH_SHORT).show();});card.addView(copy);HorizontalScrollView scroll=new HorizontalScrollView(parent.getContext());TextView text=base(parent,ink);text.setTypeface(Typeface.MONOSPACE);text.setTextSize(13);text.setText(code);scroll.addView(text);card.addView(scroll);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,10,0,14);parent.addView(card,lp);}else{TextView text=base(parent,ink);text.setText(format(part));parent.addView(text,new LinearLayout.LayoutParams(-1,-2));}}}
 static TextView base(LinearLayout parent,int color){TextView t=new TextView(parent.getContext());t.setTextColor(color);t.setTextSize(16);t.setLineSpacing(5,1.12f);t.setTextIsSelectable(true);t.setPadding(0,0,0,8);return t;}
 static CharSequence format(String s){SpannableStringBuilder b=new SpannableStringBuilder(s.replaceAll("(?m)^[-*] ","• "));Pattern bold=Pattern.compile("\\*\\*(.+?)\\*\\*",Pattern.DOTALL);Matcher m=bold.matcher(b);while(m.find()){int start=m.start(),end=m.end();String inside=m.group(1);b.replace(start,end,inside);b.setSpan(new StyleSpan(Typeface.BOLD),start,start+inside.length(),33);m=bold.matcher(b);}Matcher h=Pattern.compile("(?m)^#{1,4} (.+)$").matcher(b);while(h.find()){int start=h.start(),end=h.end();String inside=h.group(1);b.replace(start,end,inside);b.setSpan(new StyleSpan(Typeface.BOLD),start,start+inside.length(),33);b.setSpan(new RelativeSizeSpan(1.14f),start,start+inside.length(),33);h=Pattern.compile("(?m)^#{1,4} (.+)$").matcher(b);}return b;}
}
