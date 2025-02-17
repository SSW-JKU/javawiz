public class EscapeLoop {
    public static void main(String[] args) {
        outer: for(int i = 0; i < 5; i++) {
            System.out.println("1");
            if(i == 4) {
                continue;
            }
            System.out.println("2");
            int j = i;
            while(j < 5) {
                j++;
                if(j == 1) {
                    break;
                } else if(j == 2) {
                    continue;
                } else if(j == 3) {
                    continue outer;
                }
                System.out.println("3");
            }

            do {
                if(j == 2) {
                    continue outer;
                } else if(j == 1) {
                    break;
                }
                j--;
                System.out.println("4");
            } while(j > 0);

            System.out.println("5");

        }
    }
}