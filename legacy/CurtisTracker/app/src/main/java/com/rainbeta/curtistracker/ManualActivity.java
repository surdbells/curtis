package com.rainbeta.curtistracker;

import android.Manifest;
import android.app.ProgressDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.Location;
import android.media.MediaPlayer;
import android.os.BatteryManager;
import android.os.Bundle;
import android.os.Handler;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v4.content.ContextCompat;
import android.support.v7.app.AppCompatActivity;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.util.Log;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.MenuInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.android.volley.DefaultRetryPolicy;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;
import com.google.zxing.Result;
import com.rainbeta.curtistracker.android_serialport_api.SoftDecodingAPI;
import com.rainbeta.curtistracker.android_serialport_api.Util;
import com.rainbeta.curtistracker.model.Banks;
import com.rainbeta.curtistracker.model.Branches;
import com.toptoche.searchablespinnerlibrary.SearchableSpinner;

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
import java.util.Map;
import java.util.Timer;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import cn.pda.scan.ScanThread;
import me.dm7.barcodescanner.zxing.ZXingScannerView;

import static java.nio.charset.StandardCharsets.UTF_16;

public class ManualActivity extends AppCompatActivity implements ZXingScannerView.ResultHandler {
    private static String TAGG = ManualActivity.class.getSimpleName();
    private Handler mhandler;
    private SoftDecodingAPI api;
    private ZXingScannerView mScannerView;
    private String TAG = "Cancel";
    private ProgressDialog progressDialog;
    private FirebaseDatabase database;
    private FirebaseAuth firebaseAuth;
    private MediaPlayer mp;

    private String xnSeals;
    private String xnBankId;
    private String xnBranchId;
    private String xnDateNow;
    private String xnLatitude;
    private String xnLongitude;
    private String xnDeviceId;
    private String xnUserId;
    private String xnXMLResponse;
    private String xnREmail;
    private String xnRPhone;

    String batteryLevel;

    public static final String SEALS = "seals";
    public static final String BANK_ID = "originationid";              // Originating Bank //
    public static final String BRANCH_ID = "originationbranchid";

    public static final String DES_ID = "destinationbankid";              // Destination Bank //
    public static final String DES_BR_ID = "destinationbranchid";          // Destination Branch
    public static final String PROCESS_TYPE = "proctype";
    public static final String DATE_NOW = "DateTime";
    public static final String LONGITUDE = "longitude";
    public static final String LATITUDE = "latitude";
    public static final String DEVICE_ID = "deviceId";
    public static final String USER_ID = "userid";
    public static final String XML_RESPONSE = "xmlresponse";
    public static final String EMAIL_ADDRESS = "email";
    public static final String PHONE_NUMBER = "phone";
    public static final String BATTERY_LEVEL = "batterylevel";



    ArrayList<Banks> servedBanks = new ArrayList<>();
    ArrayList<Branches> servedBranches = new ArrayList<>();

    private SearchableSpinner bankSpinner, branchSpinner;
    private EditText edEmail, edPhone, editTextSealInput;
    private Button sSubmmit, sProcess, sConfirm;
    private LinearLayout contentv, scanv, success;
    private TextView countscan, countseals, feedbk;
    private FusedLocationProviderClient CurtisLocationClient;
    protected Location mLastLocation;

    ArrayList<String> data = new ArrayList<String>();
    private String holdData;
    /////
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
                Toast.makeText(ManualActivity.this, data, Toast.LENGTH_SHORT).show();
                Util.play(1, 0);
            }
        };
    };
///
        @Override
        protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_manual);

            // Getting Battery Info
            BatteryManager bm = (BatteryManager)getSystemService(BATTERY_SERVICE);
            int batLevel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            batteryLevel = String.valueOf(batLevel);
            //    Toast.makeText(this, String.valueOf(batLevel), Toast.LENGTH_LONG).show();

        feedbk = (TextView) findViewById(R.id.fback);
        // Scanner Config
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


        mScannerView = new ZXingScannerView(this);
        mp = MediaPlayer.create(this, R.raw.beep);
        android.support.v7.app.ActionBar ab = getSupportActionBar();
        if (ab != null) {
            ab.setDisplayHomeAsUpEnabled(true);
        }
        requestCamera();
        countscan = findViewById(R.id.txtcountseals);
        countseals = findViewById(R.id.seals);
        contentv = findViewById(R.id.userContainer);
        scanv = findViewById(R.id.scanView);
        scanv.addView(mScannerView);
        success = findViewById(R.id.afterpost);
        edEmail = findViewById(R.id.email);
        edPhone = findViewById(R.id.phoneNumber);
        sSubmmit = findViewById(R.id.sucbutton);
        sProcess = findViewById(R.id.pButton);
        editTextSealInput = findViewById(R.id.editTextSeals);
        sConfirm = findViewById(R.id.serialConfirm);
        sConfirm.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                String confirming = editTextSealInput.getText().toString().trim();
                if (TextUtils.isEmpty(confirming)) {
                    Toast.makeText(ManualActivity.this, " Please, Enter a seal number", Toast.LENGTH_LONG).show();
                } else if(!data.contains(confirming)) {
                    data.add(confirming);
                    Toast.makeText(ManualActivity.this, confirming + ": Scanned successfully", Toast.LENGTH_SHORT).show();
                    mp.start();
                    editTextSealInput.setText("");
                    feedbk.setText(confirming + ": Scanned successfully");
                    feedbk.setTextColor(getResources().getColor(R.color.bg_login));
                    Integer count = data.size();
                    countscan.setText(Integer.toString(count));
                } else if(data.contains(confirming)) {
                    Toast.makeText(ManualActivity.this, confirming + ": Has been Scanned", Toast.LENGTH_SHORT).show();
                    editTextSealInput.setText("");
                    feedbk.setText(confirming + ": Has been Scanned");
                    feedbk.setTextColor(getResources().getColor(R.color.colorPrimaryDark));
                }
                holdData= String.valueOf(data);
                xnSeals = holdData.replace(" ", "").replace("[", "").replace("]", "");
            }
        });

        Button endButton = findViewById(R.id.scandone);
        endButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                scanv.setVisibility(View.GONE);
                contentv.setVisibility(View.VISIBLE);
                Integer count = data.size();
                countseals.setText(Integer.toString(count) + " " + "SEALS");
               // mCodeScanner.startPreview();
            }
        });

        sSubmmit.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                postSuccess();
            }
        });

        sProcess.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                postEvacuation();
            }
        });

        Button startButton = findViewById(R.id.newscan);
        startButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                mScannerView.startCamera();
                mScannerView.setAutoFocus(true);
            }
        });

        progressDialog = new ProgressDialog(this);
        CurtisLocationClient = LocationServices.getFusedLocationProviderClient(this);
        getLastLocation();
        firebaseAuth = FirebaseAuth.getInstance();
        database = FirebaseDatabase.getInstance();
        bankSpinner =  findViewById(R.id.bankSpinner);
        bankSpinner.setTitle("SELECT BANK");
        branchSpinner =  findViewById(R.id.branchSpinner);
        branchSpinner.setTitle("SELECT BRANCH");
        loadBanks();
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        MenuInflater inflater = getMenuInflater();
        inflater.inflate(R.menu.activity_manual_actions, menu);
        return super.onCreateOptionsMenu(menu);
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Take appropriate action for each action item click
        switch (item.getItemId()) {
            case R.id.qrmode:
                    useflash();
                return true;

            default:
                return super.onOptionsItemSelected(item);
        }
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
        editTextSealInput.setText(rawResult.getText());
        sConfirm.performClick();
        Handler handler = new Handler();
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                mScannerView.resumeCameraPreview(ManualActivity.this);
            }
        }, 1000);
    }

    public void loadBanks() {
        try {
            InputStream stream = getAssets().open("banks.xml");
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
            String Bank = "";
            String BankId = "";
            if (doc != null) {
                NodeList nl = doc.getElementsByTagName("Bank");
                for (int i = 0; i < nl.getLength(); i++) {
                    Node currentItem = nl.item(i);
                    BankId = currentItem.getAttributes().getNamedItem("id").getNodeValue(); // subject ID
                    Node node = nl.item(i);
                    Bank = node.getTextContent();
                    servedBanks.add(new Banks(BankId, Bank));
                }
                ArrayAdapter<Banks> adapter = new ArrayAdapter<Banks>(ManualActivity.this, android.R.layout.simple_spinner_dropdown_item, servedBanks);
                bankSpinner.setAdapter(adapter);
                bankSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                        Banks bank = (Banks) adapterView.getSelectedItem();
                        Toast.makeText(ManualActivity.this, "Bank ID: "+bank.getId()+",  Bank Name : "+bank.getName(), Toast.LENGTH_SHORT).show();
                        xnBankId = bank.getId();
                        servedBranches.clear();
                        loadBranches();
                    }

                    @Override
                    public void onNothingSelected(AdapterView<?> adapterView) {
                    }
                });
            }
           // loadBranches();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    private void requestCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED ) {
            int REQUEST_CODE_ASK_PERMISSIONS = 123;
            ActivityCompat
                    .requestPermissions(ManualActivity.this, new String[]{Manifest.permission.CAMERA}, REQUEST_CODE_ASK_PERMISSIONS);
        }
    }
    public void loadBranches() {
        try {
            InputStream stream = getAssets().open("branches.xml");
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
            String Branch = "";
            String BranchId = "";
            String BankId = "";
            String Bank = "";

           // String xnBankID = "1b97b4ac-1077-4240-a309-211edd9cc665"; // Tmp bank Id

            if (doc != null) {
                NodeList nl = doc.getElementsByTagName("Branch");
                for (int i = 0; i < nl.getLength(); i++) {
                    Node currentItem = nl.item(i);
                    BankId = currentItem.getAttributes().getNamedItem("bankid").getNodeValue(); // Bank ID
                    BranchId = currentItem.getAttributes().getNamedItem("id").getNodeValue(); // Branch ID
                    Bank = currentItem.getAttributes().getNamedItem("bank").getNodeValue(); // Branch ID
                    Node node = nl.item(i);
                    Branch = node.getTextContent(); // Branch
                    String mnBranch = Branch;
                    if(BankId.equals(xnBankId)) {
                        servedBranches.add(new Branches(BranchId, BankId, Bank, mnBranch));
                   //     System.out.println("Equal");
                        //    System.out.println("Select bank Bank Id: " + xnBankId);
                     //   System.out.println("Current bank Id: " + BankId);

                   } else {
                        System.out.println("Equal");
                    }
                }
                ArrayAdapter<Branches> badapter = new ArrayAdapter<Branches>(ManualActivity.this, android.R.layout.simple_spinner_dropdown_item, servedBranches);
                branchSpinner.setAdapter(badapter);
                branchSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
                    @Override
                    public void onItemSelected(AdapterView<?> adapterView, View view, int i, long l) {
                        Branches branch = (Branches) adapterView.getSelectedItem();
                        Toast.makeText(ManualActivity.this, "Branch ID: " + branch.getId() + ",  Branch Name : " + branch.getBranchName(), Toast.LENGTH_SHORT).show();
                        xnBranchId = branch.getId();
                    }

                    @Override
                    public void onNothingSelected(AdapterView<?> adapterView) {

                    }
                });
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    public void getLastLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            // TODO: Consider calling
            //    ActivityCompat#requestPermissions
            // here to request the missing permissions, and then overriding
            //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
            //                                          int[] grantResults)
            // to handle the case where the user grants the permission. See the documentation
            // for ActivityCompat#requestPermissions for more details.
            return;
        }
        CurtisLocationClient.getLastLocation()
                .addOnCompleteListener(this, new OnCompleteListener<Location>() {
                    @Override
                    public void onComplete(@NonNull Task<Location> task) {
                        if (task.isSuccessful() && task.getResult() != null) {
                            mLastLocation = task.getResult();
                            xnLongitude = String.valueOf(mLastLocation.getLongitude());
                            xnLatitude = String.valueOf(mLastLocation.getLatitude());
                        } else {
                            Toast.makeText(ManualActivity.this, "Location not Found, Try Again", Toast.LENGTH_SHORT).show();

                        }
                    }
                });

    }
    public void postEvacuation() {
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            // TODO: Consider calling
            //    ActivityCompat#requestPermissions
            // here to request the missing permissions, and then overriding
            //   public void onRequestPermissionsResult(int requestCode, String[] permissions,
            //                                          int[] grantResults)
            // to handle the case where the user grants the permission. See the documentation
            // for ActivityCompat#requestPermissions for more details.
            return;
        }
        xnDeviceId = telephonyManager.getDeviceId();

        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                progressDialog.setMessage("Processing Evacuation...");
                progressDialog.show();
                progressDialog.setCancelable(false);
                String baseUrlValue = (String) dataSnapshot.getValue();
                FirebaseUser user = firebaseAuth.getCurrentUser();
                Date now = new Date();
                SimpleDateFormat currentDate = new SimpleDateFormat("dd/MM/yyyy hh:mm aaa");
                assert user != null;
                xnUserId = user.getUid();
                xnDateNow =  currentDate.format(now);

                final String API_URL = baseUrlValue + "PostManualEvacuation";
                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                InputStream stream = new ByteArrayInputStream(response.getBytes(UTF_16));
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
                                            Toast.makeText(ManualActivity.this, "Successful", Toast.LENGTH_SHORT).show();
                                            xnXMLResponse = response;
                                            scanv.setVisibility(View.GONE);
                                            contentv.setVisibility(View.GONE);
                                            success.setVisibility(View.VISIBLE);
                                            progressDialog.dismiss();
                                            scanThread.close();
                                        } else if(Status.contains("1")) {
                                            countseals.setText("Hardware Failure, Please try again.");
                                          //  Toast.makeText(ManualActivity.this, "Hardware Failure, Please try again.", Toast.LENGTH_SHORT).show();
                                            progressDialog.dismiss();
                                        }
                                    }
                                }
                               // Toast.makeText(ManualActivity.this, response, Toast.LENGTH_LONG).show();
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(ManualActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                                progressDialog.dismiss();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<String, String>();
                        params.put(SEALS, xnSeals);
                        params.put(BANK_ID, xnBankId);
                        params.put(BRANCH_ID, xnBranchId);
                        params.put(DES_BR_ID, "");
                        params.put(PROCESS_TYPE, "");
                        params.put(DATE_NOW, xnDateNow);
                        params.put(LATITUDE, xnLatitude);
                        params.put(LONGITUDE, xnLongitude);
                        params.put(DEVICE_ID, xnDeviceId);
                        params.put(USER_ID, xnUserId);
                        params.put(BATTERY_LEVEL, batteryLevel);
                        return params;
                                            }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(ManualActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(ManualActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });


    }
    public void postSuccess() {
      xnREmail = edEmail.getText().toString().trim();
      xnRPhone =  edPhone.getText().toString().trim();
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                progressDialog.setMessage("Completing Evacuation...");
                progressDialog.show();
                progressDialog.setCancelable(false);
                String baseUrlValue = (String) dataSnapshot.getValue();
                final String API_URL = baseUrlValue + "PostEvacuationReceipt";
                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                              //  Toast.makeText(ManualActivity.this, response, Toast.LENGTH_LONG).show();
                                Toast.makeText(ManualActivity.this, "Evacuation Complete.", Toast.LENGTH_LONG).show();
                                Intent i = new Intent(ManualActivity.this, DashboardActivity.class);
                                startActivity(i);
                                progressDialog.dismiss();
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(ManualActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                                progressDialog.dismiss();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<String, String>();
                        params.put(XML_RESPONSE, xnXMLResponse);
                        params.put(EMAIL_ADDRESS, xnREmail);
                        params.put(PHONE_NUMBER, xnRPhone);
                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(ManualActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                Toast.makeText(ManualActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
    public void useflash(){
        mScannerView.setFlash(true);
    }

    //Scanner More Dependencies
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
