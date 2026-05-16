package com.rainbeta.curtistracker;

import android.Manifest;
import android.app.ProgressDialog;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.v4.app.ActivityCompat;
import android.support.v7.app.AppCompatActivity;
import android.telephony.TelephonyManager;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import com.android.volley.DefaultRetryPolicy;
import com.android.volley.Request;
import com.android.volley.RequestQueue;
import com.android.volley.Response;
import com.android.volley.VolleyError;
import com.android.volley.toolbox.StringRequest;
import com.android.volley.toolbox.Volley;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.database.DataSnapshot;
import com.google.firebase.database.DatabaseError;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import com.google.firebase.database.ValueEventListener;

import java.util.HashMap;
import java.util.Map;

public class SignupActivity extends AppCompatActivity {

    public static final String USERNAME = "curtisusername";
    public static final String USER_ID = "curtisuserid";
    public static final String USER_EMAIL = "curtisemail";

    private TextView txtStatus;
    private LinearLayout userView, regiView;
    private EditText inputEmail, inputPassword, inputUsrname;
    private Button btnSignIn, btnSignUp, btnResetPassword, btnValidateUsr;
    private ProgressBar progressBar;
    private FirebaseAuth auth;
    private FirebaseDatabase database;
    private ProgressDialog progressDialog;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_signup);
        android.support.v7.app.ActionBar ab = getSupportActionBar();
        assert ab != null;
        ab.setTitle("CURTIS CHECKPOINT");
        database = FirebaseDatabase.getInstance();
        progressDialog = new ProgressDialog(this);
        //Get Firebase auth instance
        auth = FirebaseAuth.getInstance();
        valDevice();
        txtStatus = (TextView) findViewById(R.id.valStatus);
        userView = (LinearLayout) findViewById(R.id.usrview);
        regiView = (LinearLayout) findViewById(R.id.regView);
        btnSignIn = (Button) findViewById(R.id.sign_in_button);
        btnValidateUsr = (Button) findViewById(R.id.vUsrbutton);
        btnSignUp = (Button) findViewById(R.id.sign_up_button);
        inputEmail = (EditText) findViewById(R.id.email);
        inputUsrname = (EditText) findViewById(R.id.username);
        inputPassword = (EditText) findViewById(R.id.password);
        progressBar = (ProgressBar) findViewById(R.id.progressBar);
        btnResetPassword = (Button) findViewById(R.id.btn_reset_password);

        btnValidateUsr.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                valUsername();
            }
        });

        btnResetPassword.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
              //  startActivity(new Intent(SignupActivity.this, ResetPasswordActivity.class));
            }
        });

        btnSignIn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startActivity(new Intent(SignupActivity.this, MainActivity.class));
                //finish();
            }
        });

        btnSignUp.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {

                String email = inputEmail.getText().toString().trim();
                String password = inputPassword.getText().toString().trim();

                if (TextUtils.isEmpty(email)) {
                    Toast.makeText(getApplicationContext(), "Enter email address!", Toast.LENGTH_SHORT).show();
                    return;
                }

                if (TextUtils.isEmpty(password)) {
                    Toast.makeText(getApplicationContext(), "Enter password!", Toast.LENGTH_SHORT).show();
                    return;
                }

                if (password.length() < 6) {
                    Toast.makeText(getApplicationContext(), "Password too short, enter minimum 6 characters!", Toast.LENGTH_SHORT).show();
                    return;
                }

                progressBar.setVisibility(View.VISIBLE);
                //create user
                auth.createUserWithEmailAndPassword(email, password)
                        .addOnCompleteListener(SignupActivity.this, new OnCompleteListener<AuthResult>() {
                            @Override
                            public void onComplete(@NonNull Task<AuthResult> task) {
                                Toast.makeText(SignupActivity.this, "createUserWithEmail:onComplete:" + task.isSuccessful(), Toast.LENGTH_SHORT).show();
                                progressBar.setVisibility(View.GONE);
                                // If sign in fails, display a message to the user. If sign in succeeds
                                // the auth state listener will be notified and logic to handle the
                                // signed in user can be handled in the listener.
                                if (!task.isSuccessful()) {
                                    Toast.makeText(SignupActivity.this, "Authentication failed." + task.getException(),
                                            Toast.LENGTH_SHORT).show();
                                } else {
                                    auth.signOut();
                                    startActivity(new Intent(SignupActivity.this, MainActivity.class));
                                    postReg();
                                    finish();
                                }
                            }
                        });

            }
        });
    }
    public void valDevice() {
        progressDialog.setMessage("Validating Device...");
        progressDialog.setCancelable(false);
        progressDialog.show();
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(SignupActivity.this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        final String deviceId = telephonyManager.getDeviceId();
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(@NonNull DataSnapshot dataSnapshot) {
                String baseUrlValue = (String) dataSnapshot.getValue();
                final String API_URL = baseUrlValue + "ValidateDevice/" + deviceId;

                StringRequest stringRequest = new StringRequest(Request.Method.GET, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(SignupActivity.this, response, Toast.LENGTH_LONG).show();
                                if(response.contains("success")) {
                                    txtStatus.setText(R.string.vmess);
                                    userView.setVisibility(View.VISIBLE);
                                    progressDialog.dismiss();
                                } else {
                                    txtStatus.setTextColor(getResources().getColor(R.color.btn_logut_bg));
                                    txtStatus.setText(R.string.notvmess);
                                    progressDialog.dismiss();
                                }
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                txtStatus.setTextColor(getResources().getColor(R.color.btn_logut_bg));
                                txtStatus.setText(R.string.nointer);
                                progressDialog.dismiss();
                                Toast.makeText(SignupActivity.this, "Not completed, Pls Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){

                };

                RequestQueue requestQueue = Volley.newRequestQueue(SignupActivity.this);
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                progressDialog.dismiss();
                Toast.makeText(SignupActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
    public void valUsername() {
        final String usrName = inputUsrname.getText().toString().trim();
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot dataSnapshot) {
                progressDialog.setMessage("Validating Username...");
                progressDialog.setCancelable(false);
                progressDialog.show();
                String baseUrlValue = (String) dataSnapshot.getValue();
                final String API_URL = baseUrlValue + "ValidateUserName/" + usrName;

                StringRequest stringRequest = new StringRequest(Request.Method.GET, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(SignupActivity.this, response, Toast.LENGTH_LONG).show();
                                if(response.contains("success")) {
                                    txtStatus.setText("USER VERIFICATION SUCCESSFUL");
                                    userView.setVisibility(View.GONE);
                                    regiView.setVisibility(View.VISIBLE);
                                    progressDialog.dismiss();
                                } else {
                                    txtStatus.setTextColor(getResources().getColor(R.color.btn_logut_bg));
                                    txtStatus.setText("USER NOT AUTHORISED");
                                }

                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                txtStatus.setTextColor(getResources().getColor(R.color.btn_logut_bg));
                                txtStatus.setText(R.string.nointer);
                                progressDialog.dismiss();
                                Toast.makeText(SignupActivity.this, "Not completed, Pls Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){

                };

                RequestQueue requestQueue = Volley.newRequestQueue(SignupActivity.this);
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(@NonNull DatabaseError databaseError) {
                progressDialog.dismiss();
                Toast.makeText(SignupActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
    public void postReg() {
        final String usrName = inputUsrname.getText().toString().trim();
        TelephonyManager telephonyManager;
        telephonyManager = (TelephonyManager) getSystemService(Context.
                TELEPHONY_SERVICE);
        if (ActivityCompat.checkSelfPermission(SignupActivity.this, android.Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        FirebaseUser user = auth.getCurrentUser();
        final String userID = user.getUid();
        final String userEmail = user.getEmail();
      //  final String deviceId = telephonyManager.getDeviceId();
        DatabaseReference myRef = database.getReference("baseUrl");
        myRef.addValueEventListener(new ValueEventListener() {
            @Override
            public void onDataChange(DataSnapshot dataSnapshot) {
                progressDialog.setMessage("Registering...");
                progressDialog.setCancelable(false);
                progressDialog.show();
                String baseUrlValue = (String) dataSnapshot.getValue();
                final String API_URL = baseUrlValue + "PostDeviceReg";
                StringRequest stringRequest = new StringRequest(Request.Method.POST, API_URL,
                        new Response.Listener<String>() {
                            @Override
                            public void onResponse(String response) {
                                Toast.makeText(SignupActivity.this, response, Toast.LENGTH_LONG).show();
                                startActivity(new Intent(SignupActivity.this, MainActivity.class));
                                progressDialog.dismiss();
                            }
                        },
                        new Response.ErrorListener() {
                            @Override
                            public void onErrorResponse(VolleyError error) {
                                Toast.makeText(SignupActivity.this, "Not completed, Try Again", Toast.LENGTH_LONG).show();
                            }
                        }){
                    @Override
                    protected Map<String,String> getParams(){
                        Map<String,String> params = new HashMap<>();
                        params.put(USERNAME, usrName);
                        params.put(USER_ID, userID);
                        params.put(USER_EMAIL, userEmail);
                        return params;
                    }

                };

                RequestQueue requestQueue = Volley.newRequestQueue(SignupActivity.this);
                stringRequest.setRetryPolicy(new DefaultRetryPolicy(
                        5000,
                        DefaultRetryPolicy.DEFAULT_MAX_RETRIES,
                        DefaultRetryPolicy.DEFAULT_BACKOFF_MULT));
                requestQueue.add(stringRequest);
            }
            @Override
            public void onCancelled(DatabaseError databaseError) {
                Toast.makeText(SignupActivity.this, "Oops " + databaseError.getMessage(), Toast.LENGTH_LONG).show();
            }
        });


    }

    @Override
    protected void onResume() {
        super.onResume();
        progressBar.setVisibility(View.GONE);
    }
}
