public class Loops {
    public static void main(String[] args) {
        for(int i = 0; i < 2; i++) {
            System.out.println("a statement");
        }

        int j = 0;
        while(j < 2) {
            System.out.println("another statement");
            j++;
        }

        int k = 0;
        do {
            k++;
            System.out.println("another statement");
        } while(k < 2);
    }
}