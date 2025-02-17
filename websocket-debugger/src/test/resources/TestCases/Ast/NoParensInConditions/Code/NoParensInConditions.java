public class NoParensInConditions {
    public static void main(String[] args) {
        while(true) break;
        int i = 0;
        do { i++; } while(false);
        if(true) i++; else i++;
        switch(i) {
            default: break;
        }
        for(;i < 0;);
    }
}