package com.rainbeta.curtistracker.model;

public class Branches {
    private String Id;
    private String BankId;
    private String BankName;
    private String BranchName;

    public Branches(String id, String bankId, String bankName, String branchName) {
        Id = id;
        BankId = bankId;
        BankName = bankName;
        BranchName = branchName;
    }

    public String getId() {
        return Id;
    }

    public void setId(String id) {
        Id = id;
    }

    public String getBankId() {
        return BankId;
    }

    public void setBankId(String bankId) {
        BankId = bankId;
    }

    public String getBankName() {
        return BankName;
    }

    public void setBankName(String bankName) {
        BankName = bankName;
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
        if(obj instanceof Branches){
            Branches nb = (Branches) obj;
            if(nb.getBranchName().equals(BranchName) && nb.getId() == Id ) return true;
        }

        return false;
    }
}
