public class SpecialChars {
    public static void main(String[] args) {
        char c1 = '\0';
        char c2 = '\r';
        char c3 = '\uffff';
        char c4 = '#';
        char[] chars = new char[]{c1, c2, c3, c4, '\t', '\"', '\\', '\'', '\f', '\0', '\n'};
        String s = new String(chars);
    }
}