public class ParseErrorLocation {
    public static void main(String[] args) {
        Other.foo(); // This does not exist, but error should occur only if referenced files have error
    }
}