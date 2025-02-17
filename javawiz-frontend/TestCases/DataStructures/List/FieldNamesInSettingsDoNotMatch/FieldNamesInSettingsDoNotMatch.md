# Code
## Test 1
```java
public class FieldNamesInSettingsDoNotMatch {
  public static void main(String[] args) {
    Node node = new Node('a');
  }
}

class Node {
  char iAmNotInSettings;
  Node next;

  Node(char val) {
    this.iAmNotInSettings = val;
  }
}
```

## Test 2
```java
public class FieldNamesInSettingsDoNotMatch {
  public static void main(String[] args) {
    Node node = new Node();
  }
}

class Node {
  Node next;
}
```

# End Result
![img.png](img.png)