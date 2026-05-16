package com.rainbeta.curtistracker;

import android.app.ProgressDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaPlayer;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.support.annotation.NonNull;
import android.support.v7.app.AppCompatActivity;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import com.android.volley.DefaultRetryPolicy;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.zxing.Result;
import com.rainbeta.curtistracker.android_serialport_api.Util;

import org.w3c.dom.Document;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Timer;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import cn.pda.scan.ScanThread;
import me.dm7.barcodescanner.zxing.ZXingScannerView;

import static java.nio.charset.StandardCharsets.UTF_8;

public class RouteActivity extends AppCompatActivity implements ZXingScannerView.ResultHandler {
    private static String TAGG = RouteActivity.class.getSimpleName();
    static final String KEY_ITEM = "seals"; // parent node
    static final String KEY_ROUTE = "Route";
    static final String KEY_SEALS = "sealNumber";
    private FirebaseAuth firebaseAuth;
    private ZXingScannerView mScannerView;

    public static final String SEALS = "seals";
    public static final String DATE_NOW = "DateTime";
    public static final String USER_ID = "userid";
    public static final String ROUTE_ID = "routeid";
    public static final String BATTERY_LEVEL = "batterylevel";


    private String RouteId;
    private String allSeals;
    private String Seals;
    private String SealId;
    private String cRoute;

    String batteryLevel;

    private String xnSealsId;
    private String xnDateNow;
    private String xnUserId;
    private String xnRouteId;


    private ProgressDialog progressDialog;
    private FirebaseDatabase database;
    private TextView tSeals, tCounts, feedbk;
    private Spinner rtSpinner;
    private EditText editTextSealInput;
    private Button sConfirm;
    private List<String> sealsList = new ArrayList<>();
    private List<String> sealsId = new ArrayList<>();
    final List<String> sealsCount = new ArrayList<>();

    private ScanThread scanThread;
    private Timer scanTimer = null;
    private KeyReceiver keyReceiver;
    private Handler mHandler = new Handler() {
        public void handleMessage(android.os.Message msg) {
            if (msg.what == ScanThread.SCAN) {
                String data = msg.getData().getString("data");
                editTextSealInput = findViewById(R.id.editTextSeals);
                editTextSealInput.setText(data);
                sConfirm.performClick();
                Log.e(TAGG, "data = " + data);
                //     Toast.makeText(getApplicationContext(), data, 0).show();
               // Toast.makeText(RouteActivity.this, data, Toast.LENGTH_SHORT).show();
                Util.play(1, 0);
            }
        };
    };


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_route);

        // Getting Battery Info
        BatteryManager bm = (BatteryManager)getSystemService(BATTERY_SERVICE);
        int batLevel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        batteryLevel = String.valueOf(batLevel);
        //    Toast.makeText(this, String.valueOf(batLevel), Toast.LENGTH_LONG).show();

        feedbk = (TextView) findViewById(R.id.fback3);

        // Scanner Config Start
        Window window = this.getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try {
            scanThread = new ScanThread(mHandler);
            scanThread.start();
            Util.initSoundPool(this);
            keyReceiver = new KeyReceiver();
            IntentFilter filter = new IntentFilter();
            filter.addAction("android.rfid.FUN_KEY");
            filter.addAction("android.intent.action.FUN_KEY");
            registerReceiver(keyReceiver , filter);
        } catch (Exception e) {
            Toast.makeText(this, "serialport init fail", Toast.LENGTH_SHORT).show();
            return;
            // e.printStackTrace();
        }
        // Scanner Config End

        final MediaPlayer mp = MediaPlayer.create(this, R.raw.beep);
        progressDialog = new ProgressDialog(this);
        database = FirebaseDatabase.getInstance();
        firebaseAuth = FirebaseAuth.getInstance();
        tSeals = findViewById(R.id.seals);
        tCounts = findViewById(R.id.count);
        rtSpinner = findViewById(R.id.routes);

        final LinearLayout scview = (LinearLayout) findViewById(R.id.scanView);
        mScannerView = new ZXingScannerView(this);
        scview.addView(mScannerView);

        rtSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                cRoute = rtSpinner.getSelectedItem().toString().trim();
                getseals();
            }

            @Override
            public void onNothingSelected(AdapterView<?> adapterView) {

            }
        });

        editTextSealInput = findViewById(R.id.editTextSeals);
        sConfirm = findViewById(R.id.serialConfirm);
        sConfirm.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                String confirming = editTextSealInput.getText().toString().trim();
                if (sealsList.contains(confirming)) {
                    if (!sealsCount.contains(confirming)) {
                        sealsCount.add(confirming);
                        Toast.makeText(RouteActivity.this, confirming + " Confirmed successfully", Toast.LENGTH_SHORT).show();
                        editTextSealInput.setText("");
                        feedbk.setText(confirming + ": Confirmed successfully");
                        feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                        int countValue = sealsCount.size();
                        Integer count = sealsList.size();
                        if (count  == countValue) {
                            Toast.makeText(RouteActivity.this, " All Seals Confirmed", Toast.LENGTH_LONG).show();
                            feedbk.setText(confirming + ": All Seals Confirmed");
                            feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                            editTextSealInput.setText("");
                            scanThread.close();
                            postIncoming();

                        }
                        String countString = Integer.toString(countValue);
                        tCounts.setText(countString);
                    } else {
                        Toast.makeText(RouteActivity.this, confirming + " Has been counted", Toast.LENGTH_SHORT).show();
                        feedbk.setText(confirming + ": Has been counted");
                        feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                        editTextSealInput.setText("");
                    }

                } else {
                    Toast.makeText(RouteActivity.this, confirming + " Not found please confirm", Toast.LENGTH_SHORT).show();
                    feedbk.setText(confirming + ": Not found please confirm");
                    feedbk.setTextColor(getResources().getColor(R.color.colorAccent));
                    editTextSealInput.setText("");
                }
            }
        });

        Button startButton = findViewById(R.id.usecam);
        startButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                mScannerView.startCamera();
            }
        });
  }

    @Override
    public void onResume() {
        super.onResume();
        mScannerView.setResultHandler(this);
        mScannerView.setAutoFocus(true);// Register ourselves as a handler for scan results.
    }

    @Override
    public void onPause() {
        super.onPause();
        mScannerView.stopCamera();           // Stop camera on pause
    }

    @Override
    public void handleResult(Result rawResult) {
        Toast.makeText(RouteActivity.this, rawResult.getText(), Toast.LENGTH_SHORT).show();
        editTextSealInput.setText(rawResult.getText());
        sConfirm.performClick();

        Handler handler = new Handler();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                mScannerView.resumeCameraPreview(RouteActivity.this);
            }
        }, 2000);
    }
    public void getseals() {
        progressDialog.setMessage("Please Wait...");
        progressDialog.show();
        progressDialog.setCancelable(false);
        FirebaseUser user = firebaseAuth.getCurrentUser();
        assert user != null;
        xnUserId = user.getUid();
        final RequestQueue queue = Volley.newRequestQueue(this);
        // Request a string response from the provided URL.
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                String baseUrlValue = (String) dataSnapshot.getValue();
                // Toast.makeText(DeliveryActivity.this, baseUrlValue, Toast.LENGTH_LONG).show();
                final String url = baseUrlValue + "GetIncomingSealsByRoute/" + cRoute + "/" + xnUserId;
                System.out.println(url);
                StringRequest stringRequest = new StringRequest(Request.Method.GET, url,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                ArrayList<HashMap<String, String>> dataItems = new ArrayList<>();
                                InputStream stream = new ByteArrayInputStream(response.getBytes(UTF_8));
                                DocumentBuilder builder = null;
                                try {
                                    builder = DocumentBuilderFactory.newInstance()
                                            .newDocumentBuilder();
                                } catch (ParserConfigurationException e) {
                                    e.printStackTrace();
                                }
                                Document doc = null;
                                try {
                                    assert builder != null;
                                    doc = builder.parse(stream);
                                } catch (SAXException | IOException e) {
                                    e.printStackTrace();
                                }
                                if (doc != null) {
                                    NodeList nl = doc.getElementsByTagName("Status");
                                    if (nl.getLength() > 0) {
                                        Node node = nl.item(0);
                                        String Status = node.getTextContent();
                                        if(Status.contains("0")) {
                                            if (doc.getElementsByTagName(KEY_ROUTE).getLength() > 0) {
                                                RouteId = doc.getElementsByTagName(KEY_ROUTE).item(0).getAttributes().getNamedItem("routeid").getNodeValue();
                                                allSeals = doc.getElementsByTagName(KEY_ROUTE).item(0).getAttributes().getNamedItem("sealcount").getNodeValue();
                                            }
                                            if (doc.getElementsByTagName(KEY_SEALS).getLength() > 0) {
                                                nl = doc.getElementsByTagName(KEY_SEALS);
                                                for (int i = 0; i < nl.getLength(); i++) {
                                                    Node currentItem = nl.item(i);
                                                    Seals = currentItem.getTextContent();
                                                    System.out.println(Seals);
                                                    sealsList.add(Seals);
                                                }
                                                for (int i = 0; i < nl.getLength(); i++) {
                                                    Node currentItem = nl.item(i);
                                                    SealId = currentItem.getAttributes().getNamedItem("id").getNodeValue();
                                                    sealsId.add(SealId);
                                                }
                                            }
                                            tSeals.setText(allSeals);
                                            progressDialog.dismiss();
                                    } else if(Status.contains("1")) {
                                            Toast.makeText(RouteActivity.this, "There are no jobs picked up from route!", Toast.LENGTH_SHORT).show();
                                            tSeals.setText("0");
                                            progressDialog.dismiss();
                                        }
                                    }
                                }
                            }
                        }, new Response.ErrorListener() {
                    @Override
                    public void onErrorResponse(VolleyError error) {
                        Toast.makeText(RouteActivity.this, "No response from Server", Toast.LENGTH_SHORT).show();
                        progressDialog.dismiss();
                    }
                });
                // Add the request to the RequestQueue.
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                queue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(RouteActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }


        });
    }
    public void postIncoming() {
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                progressDialog.setMessage("Processing Seals..");
                progressDialog.show();
                progressDialog.setCancelable(false);
                FirebaseUser user = firebaseAuth.getCurrentUser();
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                assert user != null;
                xnUserId = user.getUid();
                xnDateNow =  currentDate.format(now);
                xnRouteId = RouteId;
                String holdData = String.valueOf(sealsId);
                xnSealsId = holdData.replace(" ", "").replace("[", "").replace("]", "");
                System.out.println("All Confirmed Seals Id: " + xnSealsId);

                String baseUrlValue = (String) dataSnapshot.getValue();
                final String API_URL = baseUrlValue + "PostIncomingSealsByRoute";
                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                // Toast.makeText(RouteActivity.this, response, Toast.LENGTH_LONG).show();
                                Toast.makeText(RouteActivity.this, "Successful", Toast.LENGTH_LONG).show();
                                Intent i = new Intent(RouteActivity.this, DashboardActivity.class);
                                scanThread.close();
                                startActivity(i);
                                progressDialog.dismiss();
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(RouteActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                                progressDialog.dismiss();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<String, String>();
                        params.put(SEALS, xnSealsId);
                        params.put(USER_ID, xnUserId);
                        params.put(DATE_NOW, xnDateNow);
                        params.put(ROUTE_ID, xnRouteId);
                        params.put(BATTERY_LEVEL, batteryLevel);

                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(RouteActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(RouteActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });

    }

    long exitSytemTime = 0;
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_HOME) {
            scanThread.scan();
        }

        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (System.currentTimeMillis() - exitSytemTime > 2000) {
                Toast.makeText(getApplicationContext(), R.string.exitSystem,
                        Toast.LENGTH_SHORT).show();
                exitSytemTime = System.currentTimeMillis();
                return true;
            } else {
                finish();
            }
        }
        return super.onKeyDown(keyCode, event);
    }
    @Override
    protected void onDestroy() {
        if(scanTimer!= null){
            scanTimer.cancel();
        }
        if (scanThread != null) {
            scanThread.interrupt();
            scanThread.close();
        }

        unregisterReceiver(keyReceiver);
        super.onDestroy();
    }
    // Scanner Key Receiver
    private boolean mIsPressed = false;
    private class KeyReceiver extends BroadcastReceiver {

        @Override
        public void onReceive(Context context, Intent intent) {
            int keyCode = intent.getIntExtra("keyCode", 0);
            // Ϊ�������ڰ汾����
            if (keyCode == 0) {
                keyCode = intent.getIntExtra("keycode", 0);
            }
            boolean keyDown = intent.getBooleanExtra("keydown", false);
            if (keyDown && !mIsPressed) {
                // ������Ҫ�ڶ�Ӧ�İ����ļ�ֵ�п���ɨ��,
                switch (keyCode) {
                    case KeyEvent.KEYCODE_F1:

                    case KeyEvent.KEYCODE_F2:

                    case KeyEvent.KEYCODE_F3:

                    case KeyEvent.KEYCODE_F4:

                    case KeyEvent.KEYCODE_F5:

                    default:
                        //����ɨ��
                        mIsPressed = true;
                        scanThread.scan();
                        break;
                }
            }else {
                mIsPressed = false;
            }
        }
    }
}
