public class TaskManagerApplication {
  public static String[] createSubTasksFromInput() {
    Out.print("# of Subtasks: ");
    int nSubTasks = In.readInt();
    In.readLine();
    String[] subTasks = new String[nSubTasks];
    for (int i = 0; i < subTasks.length; i++) {
      Out.print(String.format("Subtask %d: ", (i + 1)));
      subTasks[i] = In.readLine();
    }
    return subTasks;
  }

  public static Task createTaskFromInput() {
    Out.println("Creating new task:");
    Out.print("Type ([1] default, [2] detailed, [3] repeated): ");
    int type = In.readInt();
    In.readLine();
    String title;
    int priority;
    switch (type) {
      case 1:
        // Task
        Out.print("Title: ");
        title = In.readLine();
        Out.print("Priority: ");
        priority = In.readInt();
        In.readLine();
        return new Task(title, priority);
      case 2:
        // DetailedTask
        Out.print("Title: ");
        title = In.readLine();
        Out.print("Priority: ");
        priority = In.readInt();
        return new DetailedTask(title, priority, createSubTasksFromInput());
      case 3:
        // RepeatedDetailedTask
        Out.print("Title: ");
        title = In.readLine();
        Out.print("Priority: ");
        priority = In.readInt();
        String[] subTasks = createSubTasksFromInput();
        Out.print("# of executions: ");
        int nExecutions = In.readInt();
        return new RepeatedDetailedTask(title, priority, subTasks, nExecutions);
      default:
        Out.println("Invalid input!");
        return null;
    }
  }

  public static void main(String[] args) {
    TaskManager tm = new TaskManager();
    char c;
    do {
      Out.print("Command ([c] create task, [e] execute task, [s] print summary, [q] exit]: ");
      c = In.readChar();
      switch (c) {
        case 'c':
          Task t = createTaskFromInput();
          if (tm.addTask(t)) {
            Out.println("Successfully registered task!");
          } else {
            Out.println("Task list is full!");
          }
          break;
        case 'e':
          Out.print("Task to execute: ");
          int taskNr = In.readInt();
          In.readLine();
          if (tm.executeTask(taskNr)) {
            Out.println(String.format("Task %d successfully executed", taskNr));
          } else {
            Out.println("Could not execute task! Invalid task number " + taskNr);
          }
          break;
        case 's':
          tm.print();
          break;
        case 'q':
          break;
        default:
          Out.println("Invalid command: " + c);
      }
    } while (c != 'q');
    Out.println("Task manager shutdown");
  }
}

