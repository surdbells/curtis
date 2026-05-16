package com.rainbeta.curtistracker.model;

public class Rebranches {
    private String Id;
    private String ClientId;
    private String ClientName;
    private String BranchName;

    public Rebranches(String id, String clientId, String clientName, String branchName) {
        Id = id;
        ClientId = clientId;
        ClientName = clientName;
        BranchName = branchName;
    }

    public String getId() {
        return Id;
    }

    public void setId(String id) {
        Id = id;
    }

    public String getClientId() {
        return ClientId;
    }

    public void setClientId(String clientId) {
        ClientId = clientId;
    }

    public String getClientName() {
        return ClientName;
    }

    public void setClientName(String clientName) {
        ClientName = clientName;
    }

    public String getBranchName() {
        return BranchName;
    }

    public void setBranchName(String branchName) {
        BranchName = branchName;
    }

    @Override
    public String toString() {
        return BranchName;
    }

    @Override
    public boolean equals(Object obj) {
        if(obj instanceof Rebranches){
            Rebranches rb = (Rebranches) obj;
            if(rb.getBranchName().equals(BranchName) && rb.getId() == Id ) return true;
        }

        return false;
    }
}
