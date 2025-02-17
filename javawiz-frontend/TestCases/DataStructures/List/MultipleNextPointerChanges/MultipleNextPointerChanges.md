# Code
```java
public class MultipleNextPointerChanges {
  public static void main(String[] args) {
    List list = new List();
    Node a = new Node('a');
    Node b = new Node('b');
    Node c = new Node('c');
    list.head = a;
    
    a.next = b; b.next = c;
  }
}

class List {
  Node head = null;
}

class Node {
  char val;
  Node next;

  Node(char val) {
    this.val = val;
  }
}
```

# End Result
![img.png](img.png)