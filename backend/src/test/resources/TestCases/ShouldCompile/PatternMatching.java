public class PatternMatching {
    public static void main(String[] args){
        String s = "as";
        Object o = s;
        if(o instanceof String x){
            System.out.println(x);
        }
        Object o1 = s;
        if((o instanceof String x) && (o1 instanceof String y)) {
            System.out.println(y);
            System.out.println(x);
        }
    }
}