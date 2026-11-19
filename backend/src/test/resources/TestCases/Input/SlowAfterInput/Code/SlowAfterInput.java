import java.util.Scanner;

public class SlowAfterInput {
    public static void main(String[] args) throws InterruptedException {
        Scanner scanner = new Scanner(System.in);
        String text = scanner.nextLine();
        Thread.sleep(11000);
        System.out.println("read " + text);
    }
}
