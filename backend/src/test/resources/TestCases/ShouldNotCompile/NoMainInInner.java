public class NoMainInInner {
    public static class Inner {
        public static void main(String[] args) {
            System.out.println("This should not work");
        }
    }
}