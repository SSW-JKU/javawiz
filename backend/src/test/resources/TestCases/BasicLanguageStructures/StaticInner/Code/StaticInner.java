class StaticInner {
    static class Inner{}

    public static void main(String[] args) {
        Inner inner = new Inner();
        System.out.println("success");
    }
}
