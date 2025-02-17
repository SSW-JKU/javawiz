# Code
```java
public class MultiplePointersToOneNode {
  public static void main(String[] args) {
    Node a = new Node('x');
    Node b = a;
    Node c = a;
    Node d = a;
    Node e = a;
    Node f = a;
  }
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