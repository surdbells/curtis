package com.rainbeta.curtistracker;

import android.app.ProgressDialog;
import android.content.Intent;
import android.os.Bundle;
import android.support.annotation.NonNull;
import android.support.v7.app.AppCompatActivity;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketAddress;

public class MainActivity extends AppCompatActivity implements ConnectivityReceiver.ConnectivityReceiverListener, View.OnClickListener {


    //defining views
    private Button buttonSignIn;
    private EditText editTextEmail;
    private EditText editTextPassword;
    private FirebaseAuth firebaseAuth;
    private ProgressDialog progressDialog;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        //getting firebase auth object
        firebaseAuth = FirebaseAuth.getInstance();
        //if the objects getcurrentuser method is not null
        //means user is already logged in
        if(firebaseAuth.getCurrentUser() != null){
            //close this activity
            finish();
            //opening Dashboard Activity
            startActivity(new Intent(getApplicationContext(), DashboardActivity.class));
        }

        //initializing views
        editTextEmail = (EditText) findViewById(R.id.editTextEmail);
        editTextPassword = (EditText) findViewById(R.id.editTextPassword);
        buttonSignIn = (Button) findViewById(R.id.buttonSignin);

        progressDialog = new ProgressDialog(this);

        //attaching click listener
        buttonSignIn.setOnClickListener(this);
    }

    //method for user login
    private void userLogin(){
        String email = editTextEmail.getText().toString().trim();
        String password  = editTextPassword.getText().toString().trim();


        //checking if email and passwords are empty
        if(TextUtils.isEmpty(email)){
            Toast.makeText(this,"Please enter email",Toast.LENGTH_LONG).show();
            return;
        }

        if(TextUtils.isEmpty(password)){
            Toast.makeText(this,"Please enter password",Toast.LENGTH_LONG).show();
            return;
        }

        //if the email and password are not empty
        //displaying a progress dialog

        progressDialog.setMessage("Wait.. Authenticating...");
        progressDialog.show();

        //logging in the user
        firebaseAuth.signInWithEmailAndPassword(email, password)
                .addOnCompleteListener(this, new OnCompleteListener<AuthResult>() {
                    @Override
                    public void onComplete(@NonNull Task<AuthResult> task) {
                        progressDialog.dismiss();
                        //if the task is successfull
                        if(task.isSuccessful()){
                            //start the dashhboard activity
                            finish();
                            startActivity(new Intent(getApplicationContext(), DashboardActivity.class));
                        } else {
                            Toast.makeText(MainActivity.this, "Authentication failed, Check Credentials", Toast.LENGTH_SHORT).show();
                        }
                    }
                });

    }

    @Override
    public void onClick(View view) {
        if(view == buttonSignIn){
            userLogin();
        }
    }

/*    private void checkConnection() {
        boolean isConnected = ConnectivityReceiver.isConnected();
        showToast(isConnected);
    }*/

    public boolean isInternetAvailable(String address, int port, int timeoutMs) {
        try {
            Socket sock = new Socket();
            SocketAddress sockaddr = new InetSocketAddress(address, port);
            sock.connect(sockaddr, timeoutMs); // This will block no more than timeoutMs
            sock.close();
            return true;
        } catch (IOException e) { return false; }
    }

    // Showing the status Toast
    private void showToast(boolean isConnected) {
        String message;
        if (isConnected) {
            message = "Good! Connected to Internet";
            Thread thread = new Thread(new Runnable(){
                public void run() {
                    if (isInternetAvailable("216.58.212.110", 80, 1000)) {
                        // Internet available, do something
                        runOnUiThread(new Runnable() {
                            public void run() {
                                Toast.makeText(getApplicationContext(),"Your Internet is Active",Toast.LENGTH_SHORT).show();
                            }
                        });
                    } else {

                        runOnUiThread(new Runnable() {
                            public void run() {
                                Toast.makeText(getApplicationContext(),"Your Internet is not Active",Toast.LENGTH_SHORT).show();
                            }
                        });
                        // Internet not available
                    }

                }
            });
            thread.start();

        } else {
            message = "Sorry! Not connected to internet";
        }

        Toast.makeText(getApplicationContext(),message,Toast.LENGTH_SHORT).show();
    }

    @Override
    protected void onResume() {
        super.onResume();

        // register connection status listener
        BaseApplication.getInstance().setConnectivityListener(this);
    }

    @Override
    public void onNetworkConnectionChanged(boolean isConnected) {
        showToast(isConnected);
    }
}