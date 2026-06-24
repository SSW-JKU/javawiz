public class ReturnFromFor {
    public static void main(String[] args) {
        for(int i = 0; i < 10; System.out.println("This should not be printed")) {
            return;
        }
    }
}
