package cn.aiworkspace.personal;
import android.content.*;
import android.graphics.*;
import android.graphics.drawable.*;
import android.content.res.ColorStateList;
import android.view.*;

final class Icons extends View {
 final String name;final int color;final Paint p=new Paint(3);
 Icons(Context c,String name,int color,String description){super(c);this.name=name;this.color=color;setContentDescription(description);setFocusable(true);GradientDrawable shape=new GradientDrawable();shape.setColor(Color.TRANSPARENT);shape.setCornerRadius(100);setBackground(new RippleDrawable(ColorStateList.valueOf(0x16000000),shape,shape));}
 @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);canvas.save();canvas.translate((getWidth()-24*getResources().getDisplayMetrics().density)/2,(getHeight()-24*getResources().getDisplayMetrics().density)/2);float scale=getResources().getDisplayMetrics().density;canvas.scale(scale,scale);p.setColor(color);p.setStrokeWidth(1.7f);p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);
  if(name.equals("menu")){line(canvas,4,7,20,7);line(canvas,4,12,16,12);line(canvas,4,17,20,17);}
  else if(name.equals("new")){canvas.drawRoundRect(4,4,20,20,4,4,p);line(canvas,8,12,16,12);line(canvas,12,8,12,16);}
  else if(name.equals("send")){line(canvas,12,19,12,5);line(canvas,6,11,12,5);line(canvas,12,5,18,11);}
  else if(name.equals("stop")){p.setStyle(Paint.Style.FILL);canvas.drawRoundRect(7,7,17,17,2,2,p);}
  else if(name.equals("back")){line(canvas,19,12,5,12);line(canvas,5,12,11,6);line(canvas,5,12,11,18);}
  else if(name.equals("close")){line(canvas,6,6,18,18);line(canvas,18,6,6,18);}
  else if(name.equals("more")){p.setStyle(Paint.Style.FILL);for(int x:new int[]{5,12,19})canvas.drawCircle(x,12,1.4f,p);}
  else if(name.equals("attach")){Path path=new Path();path.moveTo(8,16);path.lineTo(16,8);path.cubicTo(19,5,23,9,20,12);path.lineTo(11,21);path.cubicTo(6,26,0,19,5,14);path.lineTo(15,4);canvas.translate(0,-2);canvas.drawPath(path,p);}
  else if(name.equals("folder")){Path path=new Path();path.moveTo(3,7);path.lineTo(3,19);path.lineTo(21,19);path.lineTo(21,7);path.lineTo(11,7);path.lineTo(9,4);path.lineTo(3,4);path.close();canvas.drawPath(path,p);}
  canvas.restore();}
 void line(Canvas c,float a,float b,float d,float e){c.drawLine(a,b,d,e,p);}
}
