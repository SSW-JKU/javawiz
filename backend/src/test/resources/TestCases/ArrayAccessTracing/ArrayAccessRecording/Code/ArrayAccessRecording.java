public class ArrayAccessRecording {
    public static void main(String[] args) {

        int size = 10;
        int[] xs = new int[size];
        xs[0]++;
        foo();
        for(int i = 1; i <= size; i++) {
            xs[size - i] = i;
            if(i < 5) {
                xs[size - i]++;
            }
        }
    }

    public static void foo() {
        int[] xs = new int[2];
        xs[0]++;
    }
}