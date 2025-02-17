public class ArrayAccessSourceTargetVariables {
    public static void main(String[] args) {
        int[] a = {1, 2, 3};
        a[0] = a[1];
        int invisible = 0;
        int i = a[0];
        int j = a[invisible];
        i = a[2];
        j = a[0];
        a[1] = i * j + invisible;
        a[j] = i * a[j];
    }
}