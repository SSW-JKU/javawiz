public class TaskManager {
  public static final int MAX_CAPACITY = 10;

  public Task[] tasks;
  public int pos;

  public TaskManager() {
    tasks = new Task[MAX_CAPACITY];
    pos = 0;
  }

  public boolean addTask(Task task) {
    if (pos < tasks.length) {
      tasks[pos] = task;
      pos++;
      return true;
    } else {
      return false;
    }
  }

  public boolean executeTask(int taskNr) {
    if (0 <= taskNr && taskNr < pos) {
      tasks[taskNr].execute();
      return true;
    }
    return false;
  }

  public void print() {
    Out.println(pos + " tasks registered: ");
    for (int i = 0; i < pos; i++) {
      Out.println(tasks[i].getDescription());
    }
  }
}
