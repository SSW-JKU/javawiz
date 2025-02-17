public class Conditions {
    public static void main(String[] args) {
        int i = 0;
        if(i == 0) {
            Out.println("i is zero");
        } else {
            Out.println("i is nonzero");
        }

        if(i != 0) {
            Out.println("i is nonzero");
        } else if(i  == 0) {
            Out.println("i is zero");
        }

        for(int i1 = 0; i1 < 2; i1++) {
            Out.println(i1);
        }


        int i2 = -2;
        do {
            i2++;
        } while(i2 <= 0);

        int i3 = 0;
        while(i3 < 1) {
            Out.println(i3);
            i3++;
        }
        if(true) return;
        Out.println("done");

    }
}
