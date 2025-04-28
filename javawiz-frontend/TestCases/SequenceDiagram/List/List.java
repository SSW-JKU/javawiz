public class List {
    Node head;
    List() {
        this.head = null;
    }
    void add(String s) {
        Node n = new Node(s);
        if (head == null) {
            head = n;
        }
    }
}