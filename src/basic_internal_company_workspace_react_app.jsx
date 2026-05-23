import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  /* Mobile-only view switch. On lg+ screens both panels show
     side by side and this state is ignored. */
  const [mobileView, setMobileView] = useState('tasks')

  return (
    <div className='min-h-screen bg-white text-slate-900 p-3 sm:p-6'>
      <div className='max-w-[1600px] mx-auto'>
        <header className='mb-4 sm:mb-6'>
          <h1 className='text-2xl sm:text-3xl font-bold leading-tight'>
            PoR x Summit x LL Workspace Tracker
          </h1>
          <p className='text-slate-500 mt-1 text-sm'>
            Internal operations workspace.
          </p>
        </header>

        <PinnedLinks />

        {/* Mobile tab switcher — hidden on lg+ */}
        <div className='flex gap-2 mb-4 lg:hidden'>
          <button
            onClick={() => setMobileView('tasks')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
              mobileView === 'tasks'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setMobileView('chat')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
              mobileView === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Chat
          </button>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start'>
          {/* On mobile, show only the selected panel; on lg+ show both */}
          <div className={mobileView === 'tasks' ? '' : 'hidden lg:block'}>
            <TaskPanel />
          </div>
          <div className={mobileView === 'chat' ? '' : 'hidden lg:block'}>
            <ChatPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

/* Pinned company links bar. Stored in Supabase `links` table so the
   list persists and syncs across the team. Add / edit / remove. */
function PinnedLinks() {
  const [links, setLinks] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [draftName, setDraftName] = useState('')
  const [draftUrl, setDraftUrl] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let active = true

    const loadLinks = async () => {
      const { data, error } = await supabase
        .from('links')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (!active) return
      if (error) {
        console.error('Error loading links:', error)
      } else {
        setLinks(data || [])
      }
    }

    loadLinks()

    const channel = supabase
      .channel('links-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'links' },
        loadLinks
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  /* Make sure a URL has a protocol so the anchor works */
  const normalizeUrl = (url) => {
    const trimmed = url.trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return 'https://' + trimmed
  }

  const startEdit = (link) => {
    setEditingId(link.id)
    setDraftName(link.name)
    setDraftUrl(link.url)
    setAdding(false)
  }

  const saveEdit = async (id) => {
    if (!draftName.trim() || !draftUrl.trim()) return
    const { error } = await supabase
      .from('links')
      .update({ name: draftName.trim(), url: normalizeUrl(draftUrl) })
      .eq('id', id)
    if (error) console.error('Error updating link:', error)
    setEditingId(null)
  }

  const removeLink = async (id) => {
    const { error } = await supabase.from('links').delete().eq('id', id)
    if (error) console.error('Error deleting link:', error)
  }

  const addLink = async () => {
    if (!draftName.trim() || !draftUrl.trim()) return
    const { error } = await supabase.from('links').insert({
      name: draftName.trim(),
      url: normalizeUrl(draftUrl),
      position: links.length
    })
    if (error) console.error('Error adding link:', error)
    setDraftName('')
    setDraftUrl('')
    setAdding(false)
  }

  return (
    <div className='mb-4 sm:mb-6 bg-slate-50 border border-slate-200 rounded-2xl p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        {links.map((link) =>
          editingId === link.id ? (
            <div
              key={link.id}
              className='flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl p-1.5 flex-wrap'
            >
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder='Name'
                className='border border-slate-300 rounded px-2 py-1 text-xs w-32'
              />
              <input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder='URL'
                className='border border-slate-300 rounded px-2 py-1 text-xs w-44'
              />
              <button
                onClick={() => saveEdit(link.id)}
                className='text-xs text-blue-600 px-1'
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className='text-xs text-slate-400 px-1'
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              key={link.id}
              className='flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5'
            >
              <a
                href={link.url}
                target='_blank'
                rel='noreferrer'
                className='text-sm font-medium text-blue-600 hover:underline'
              >
                {link.name}
              </a>
              <button
                onClick={() => startEdit(link)}
                className='text-[11px] text-slate-400 hover:text-slate-600 px-1'
              >
                Edit
              </button>
              <button
                onClick={() => removeLink(link.id)}
                className='text-[11px] text-red-400 hover:text-red-600 px-1'
              >
                ✕
              </button>
            </div>
          )
        )}

        {adding ? (
          <div className='flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl p-1.5 flex-wrap'>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder='Name'
              className='border border-slate-300 rounded px-2 py-1 text-xs w-32'
            />
            <input
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder='URL'
              className='border border-slate-300 rounded px-2 py-1 text-xs w-44'
            />
            <button onClick={addLink} className='text-xs text-blue-600 px-1'>
              Add
            </button>
            <button
              onClick={() => {
                setAdding(false)
                setDraftName('')
                setDraftUrl('')
              }}
              className='text-xs text-slate-400 px-1'
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setAdding(true)
              setEditingId(null)
              setDraftName('')
              setDraftUrl('')
            }}
            className='text-xs bg-slate-200 hover:bg-slate-300 rounded-xl px-3 py-1.5 transition'
          >
            + Add link
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mapping helpers: DB uses snake_case, the UI code uses camelCase.   */
/*  These keep the rest of the component almost identical to before.  */
/* ------------------------------------------------------------------ */
function taskFromRow(row) {
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    priority: row.priority || 'Medium',
    category: row.category || '',
    status: row.status || 'Pending',
    dueDate: row.due_date || '',
    link: row.link || '',
    completed: !!row.completed
  }
}

function messageFromRow(row) {
  return {
    id: row.id,
    sender: row.username || 'Anonymous',
    text: row.text || '',
    edited: !!row.edited,
    time: row.created_at
      ? new Date(row.created_at).toLocaleTimeString()
      : ''
  }
}

function TaskPanel() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('Pending')
  const [dueDate, setDueDate] = useState('')
  const [link, setLink] = useState('')
  const [sortCategory, setSortCategory] = useState('All')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [editingCategory, setEditingCategory] = useState('')
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [bulkTasks, setBulkTasks] = useState('')
  const [showBulkImporter, setShowBulkImporter] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('Group')
  /* Secondary sort applied WITHIN each category group (Group mode only) */
  const [groupSortBy, setGroupSortBy] = useState('Newest')

  /* Which category sections are collapsed. Stored as an object
     { categoryName: true }. Personal view preference -> localStorage. */
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('collapsed_categories') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(
      'collapsed_categories',
      JSON.stringify(collapsedCategories)
    )
  }, [collapsedCategories])

  const toggleCategoryCollapse = (category) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category]
    }))
  }

  /* Initial load from Supabase */
  useEffect(() => {
    let active = true

    const loadTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (!active) return

      if (error) {
        console.error('Error loading tasks:', error)
      } else {
        setTasks((data || []).map(taskFromRow))
      }
      setLoading(false)
    }

    loadTasks()

    /* Realtime: refetch whenever any task row changes */
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        loadTasks
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  const categories = useMemo(() => {
    return ['All', ...new Set(tasks.map((t) => t.category).filter(Boolean))]
  }, [tasks])

  /* Overdue = has a due date, the date is before today, and not completed */
  const isOverdue = (task) => {
    if (!task.dueDate || task.completed) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(task.dueDate)
    return due < today
  }

  /* Shared sort. 'Newest' keeps Supabase order (already newest-first). */
  const sortTasks = (list, mode) => {
    const priorityRank = { High: 0, Medium: 1, Low: 2 }
    const sorted = [...list]
    if (mode === 'Due Date') {
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate) - new Date(b.dueDate)
      })
    } else if (mode === 'Priority') {
      sorted.sort(
        (a, b) =>
          (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)
      )
    }
    return sorted
  }

  /* Category filter -> search filter -> sort. Does not mutate `tasks`. */
  const filteredTasks = useMemo(() => {
    let result =
      sortCategory === 'All'
        ? tasks
        : tasks.filter((t) => t.category === sortCategory)

    const term = searchTerm.trim().toLowerCase()
    if (term) {
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term) ||
          (t.category || '').toLowerCase().includes(term)
      )
    }

    const sorted = sortTasks(result, sortBy)

    return sorted
  }, [tasks, sortCategory, searchTerm, sortBy])

  /* Stats reflect ALL tasks, not the filtered view */
  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.completed).length
    const overdue = tasks.filter((t) => isOverdue(t)).length
    const open = tasks.length - done
    return { total: tasks.length, open, overdue, done }
  }, [tasks])

  /* Grouped view: buckets filteredTasks by category.
     Returns an array of { category, tasks } so render order is stable.
     Uncategorized tasks land in a 'No Category' group, shown last. */
  const groupedTasks = useMemo(() => {
    const groups = {}
    for (const task of filteredTasks) {
      const key = task.category || 'No Category'
      if (!groups[key]) groups[key] = []
      groups[key].push(task)
    }
    const named = Object.keys(groups)
      .filter((k) => k !== 'No Category')
      .sort((a, b) => a.localeCompare(b))
    const ordered = [...named]
    if (groups['No Category']) ordered.push('No Category')
    return ordered.map((category) => {
      const groupTasks = sortTasks(groups[category], groupSortBy)
      const done = groupTasks.filter((t) => t.completed).length
      const overdue = groupTasks.filter((t) => isOverdue(t)).length
      return {
        category,
        tasks: groupTasks,
        count: groupTasks.length,
        done,
        overdue
      }
    })
  }, [filteredTasks, groupSortBy])

  /* Reset all task-form fields to defaults */
  const resetTaskForm = () => {
    setTitle('')
    setDescription('')
    setPriority('Medium')
    setCategory('')
    setNewCategoryName('')
    setStatus('Pending')
    setDueDate('')
    setLink('')
    setEditingTaskId(null)
    setShowTaskForm(false)
  }

  /* Open the form pre-filled with a task's values for editing */
  const startEditTask = (task) => {
    setEditingTaskId(task.id)
    setTitle(task.title || '')
    setDescription(task.description || '')
    setPriority(task.priority || 'Medium')
    setCategory(task.category || '')
    setNewCategoryName('')
    setStatus(task.status || 'Pending')
    setDueDate(task.dueDate || '')
    setLink(task.link || '')
    setShowTaskForm(true)
    setShowBulkImporter(false)
  }

  /* Save the form: inserts a new task, or updates the one being edited */
  const saveTask = async () => {
    if (!title.trim()) return

    const finalCategory = (newCategoryName.trim() || category || '').trim()

    const fields = {
      title,
      description,
      priority,
      category: finalCategory,
      status,
      due_date: dueDate || null,
      link
    }

    if (editingTaskId) {
      const { error } = await supabase
        .from('tasks')
        .update(fields)
        .eq('id', editingTaskId)
      if (error) {
        console.error('Error updating task:', error)
        return
      }
    } else {
      const { error } = await supabase
        .from('tasks')
        .insert({ ...fields, completed: false })
      if (error) {
        console.error('Error adding task:', error)
        return
      }
    }

    resetTaskForm()
  }

  const removeTask = (id) => {
    setTaskToDelete(id)
    setShowDeleteModal(true)
  }

  const confirmDeleteTask = async () => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskToDelete)

    if (error) console.error('Error deleting task:', error)

    setTaskToDelete(null)
    setShowDeleteModal(false)
  }

  /* ---- Bulk selection ---- */
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const clearSelection = () => setSelectedIds([])

  const bulkMarkDone = async () => {
    if (selectedIds.length === 0) return
    const { error } = await supabase
      .from('tasks')
      .update({ completed: true })
      .in('id', selectedIds)
    if (error) console.error('Error marking tasks done:', error)
    setSelectedIds([])
  }

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', selectedIds)
    if (error) console.error('Error deleting tasks:', error)
    setSelectedIds([])
    setShowBulkDeleteModal(false)
  }

  const renameCategory = async (oldCategory, updatedCategory) => {
    const { error } = await supabase
      .from('tasks')
      .update({ category: updatedCategory })
      .eq('category', oldCategory)

    if (error) console.error('Error renaming category:', error)

    setEditingCategory('')
    setNewCategoryName('')
  }

  const deleteCategory = async (categoryName) => {
    const { error } = await supabase
      .from('tasks')
      .update({ category: '' })
      .eq('category', categoryName)

    if (error) console.error('Error deleting category:', error)
  }

  const toggleTask = async (id) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return

    const { error } = await supabase
      .from('tasks')
      .update({ completed: !task.completed })
      .eq('id', id)

    if (error) console.error('Error toggling task:', error)
  }

  const importBulkTasks = async () => {
    /* Each line: "Title | Category | Priority | Description | Due Date"
       All fields after Title are optional. Priority must be
       High/Medium/Low (case-insensitive) or it falls back to Medium.
       Due Date should be YYYY-MM-DD; unparseable dates are ignored. */
    const validPriorities = { high: 'High', medium: 'Medium', low: 'Low' }

    const parsedTasks = bulkTasks
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split('|').map((p) => p.trim())
        const title = parts[0] || ''
        const category = parts[1] || ''
        const rawPriority = (parts[2] || '').toLowerCase()
        const priority = validPriorities[rawPriority] || 'Medium'
        const description = parts[3] || ''

        /* Field 5: due date. Keep only if it parses to a real date. */
        let dueDate = null
        const rawDate = parts[4] || ''
        if (rawDate) {
          const parsed = new Date(rawDate)
          if (!isNaN(parsed.getTime())) dueDate = rawDate
        }

        return {
          title,
          description,
          priority,
          category,
          status: 'Pending',
          due_date: dueDate,
          link: '',
          completed: false
        }
      })
      .filter((t) => t.title) /* drop lines with no title */

    if (parsedTasks.length === 0) return

    const { error } = await supabase.from('tasks').insert(parsedTasks)

    if (error) {
      console.error('Error importing tasks:', error)
      return
    }

    setBulkTasks('')
    setShowBulkImporter(false)
  }

  return (
    <section className='bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-sm'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5'>
        <div>
          <h2 className='text-xl font-semibold'>Operations Dashboard</h2>
          <p className='text-sm text-slate-500'>
            Manage workflow and priorities.
          </p>
        </div>

        <div className='flex gap-2'>
          <button
            onClick={() => {
              if (showTaskForm) {
                resetTaskForm()
              } else {
                resetTaskForm()
                setShowTaskForm(true)
              }
            }}
            className='flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-2xl text-sm font-semibold transition'
          >
            {showTaskForm ? 'Close Task Form' : '+ Add New Task'}
          </button>

          <button
            onClick={() => setShowBulkImporter(!showBulkImporter)}
            className='flex-1 sm:flex-none bg-slate-200 hover:bg-slate-300 px-4 py-2.5 rounded-2xl text-sm font-semibold transition'
          >
            {showBulkImporter ? 'Close Importer' : 'Bulk Import'}
          </button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2 mb-5'>
        <span className='bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600'>
          {stats.total} total
        </span>
        <span className='bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-medium text-blue-700'>
          {stats.open} open
        </span>
        <span
          className={`border rounded-xl px-3 py-1.5 text-xs font-medium ${
            stats.overdue > 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-slate-100 border-slate-200 text-slate-500'
          }`}
        >
          {stats.overdue} overdue
        </span>
        <span className='bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 text-xs font-medium text-green-700'>
          {stats.done} done
        </span>
      </div>

      <div className='mb-5 space-y-3'>
        <div>
          <button
            onClick={() => setShowCategoryManager(!showCategoryManager)}
            className='bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-xl text-xs font-medium transition'
          >
            {showCategoryManager ? 'Hide Categories' : 'Manage Categories'}
            {categories.length > 1 ? ` (${categories.length - 1})` : ''}
          </button>

          {showCategoryManager && (
            <div className='mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3'>
              {categories.filter((cat) => cat !== 'All').length === 0 ? (
                <p className='text-xs text-slate-400'>
                  No categories yet. They are created when you add a task
                  with a category.
                </p>
              ) : (
                <div className='flex flex-wrap gap-2'>
                  {categories
                    .filter((cat) => cat !== 'All')
                    .map((cat) => (
                      <div
                        key={cat}
                        className='flex items-center gap-2 bg-white border border-slate-200 rounded-full px-3 py-1.5'
                      >
                        {editingCategory === cat ? (
                          <>
                            <input
                              defaultValue={cat}
                              onChange={(e) =>
                                setNewCategoryName(e.target.value)
                              }
                              className='bg-white border border-slate-300 rounded px-2 py-1 text-xs w-28'
                            />

                            <button
                              onClick={() =>
                                renameCategory(cat, newCategoryName || cat)
                              }
                              className='text-xs text-blue-600 px-1'
                            >
                              Save
                            </button>

                            <button
                              onClick={() => setEditingCategory('')}
                              className='text-xs text-slate-400 px-1'
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className='text-xs'>{cat}</span>

                            <button
                              onClick={() => setEditingCategory(cat)}
                              className='text-xs text-blue-600 px-1 py-0.5'
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => deleteCategory(cat)}
                              className='text-xs text-red-500 px-1 py-0.5'
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className='flex flex-wrap gap-2 items-center'>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder='Search tasks...'
            className='border border-slate-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[180px]'
          />

          <select
            value={sortCategory}
            onChange={(e) => setSortCategory(e.target.value)}
            className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
          >
            {categories.map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
          >
            <option value='Newest'>Sort: Newest</option>
            <option value='Due Date'>Sort: Due Date</option>
            <option value='Priority'>Sort: Priority</option>
            <option value='Group'>Group by Category</option>
          </select>

          {sortBy === 'Group' && (
            <div className='flex gap-2 flex-wrap items-center'>
              <select
                value={groupSortBy}
                onChange={(e) => setGroupSortBy(e.target.value)}
                className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
              >
                <option value='Newest'>Within group: Newest</option>
                <option value='Due Date'>Within group: Due Date</option>
                <option value='Priority'>Within group: Priority</option>
              </select>

              <button
                onClick={() => setCollapsedCategories({})}
                className='bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl text-xs transition'
              >
                Expand All
              </button>
              <button
                onClick={() => {
                  const all = {}
                  groupedTasks.forEach((g) => {
                    all[g.category] = true
                  })
                  setCollapsedCategories(all)
                }}
                className='bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl text-xs transition'
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {showBulkImporter && (
        <div className='bg-slate-50 border border-slate-200 rounded-3xl p-4 mb-5'>
          <div className='mb-3'>
            <h3 className='font-semibold text-sm'>Bulk Task Importer</h3>
            <p className='text-xs text-slate-500'>
              One task per line. Fields are optional, separated by | :
              <span className='font-mono'>
                {' '}
                Title | Category | Priority | Description | Due Date
              </span>
              . Priority must be High, Medium, or Low. Due Date should be
              YYYY-MM-DD. Skip a field by leaving it blank between pipes.
            </p>
          </div>

          <textarea
            value={bulkTasks}
            onChange={(e) => setBulkTasks(e.target.value)}
            placeholder={`Example:\nCall attorney | Legal | High | Discuss Smith lien | 2026-06-01\nReview CPT disputes | Provider Calls\nUpdate provider spreadsheet\nFile demand | Legal | | | 2026-06-15`}
            className='w-full min-h-40 resize-none border border-slate-300 rounded-2xl px-4 py-3 text-sm'
          />

          <button
            onClick={importBulkTasks}
            className='w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl text-sm font-semibold transition'
          >
            Import Tasks
          </button>
        </div>
      )}

      {showTaskForm && (
        <div className='bg-slate-50 border border-slate-200 rounded-3xl p-4 mb-5'>
          <h3 className='font-semibold text-sm mb-3'>
            {editingTaskId ? 'Edit Task' : 'New Task'}
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Task title'
              className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
            />

            <div className='flex gap-2 md:col-span-2 flex-wrap'>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className='border border-slate-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px]'
              >
                <option value=''>Select category</option>
                {categories
                  .filter((cat) => cat !== 'All')
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>

              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder='Or type a new category'
                className='border border-slate-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px]'
              />

              <button
                onClick={() => {
                  if (!newCategoryName.trim()) return
                  setCategory(newCategoryName)
                  setNewCategoryName('')
                }}
                className='bg-slate-200 hover:bg-slate-300 px-4 py-2 rounded-xl text-xs whitespace-nowrap'
              >
                Add
              </button>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Task notes'
              className='md:col-span-2 border border-slate-300 rounded-xl px-3 py-2 text-sm min-h-24 resize-none'
            />

            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder='Paste URL'
              className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
            />

            <input
              type='date'
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
            />

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className='border border-slate-300 rounded-xl px-3 py-2 text-sm'
            >
              <option>Pending</option>
              <option>In Progress</option>
              <option>Waiting</option>
              <option>Completed</option>
            </select>
          </div>

          <button
            onClick={saveTask}
            className='w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl text-sm font-semibold transition'
          >
            {editingTaskId ? 'Update Task' : 'Save Task'}
          </button>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className='flex items-center gap-3 flex-wrap mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3'>
          <span className='text-sm font-semibold text-blue-800'>
            {selectedIds.length} selected
          </span>

          <button
            onClick={bulkMarkDone}
            className='bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-xl text-xs font-semibold transition'
          >
            Mark Done
          </button>

          <button
            onClick={() => setShowBulkDeleteModal(true)}
            className='bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-xl text-xs font-semibold transition'
          >
            Delete
          </button>

          <button
            onClick={clearSelection}
            className='bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl text-xs transition'
          >
            Clear selection
          </button>
        </div>
      )}

      <div className='space-y-3'>
          <div className='bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-sm text-slate-400'>
            Loading tasks...
          </div>
        )}

        {!loading && filteredTasks.length === 0 && (
          <div className='bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-sm text-slate-400'>
            {tasks.length === 0
              ? 'No tasks yet. Add your first one to get started.'
              : 'No tasks match your search or filter.'}
          </div>
        )}

        {sortBy === 'Group'
          ? groupedTasks.map((group) => {
              const collapsed = !!collapsedCategories[group.category]
              return (
                <div key={group.category} className='space-y-3'>
                  <button
                    onClick={() => toggleCategoryCollapse(group.category)}
                    className='w-full flex items-center gap-2 pt-1 text-left group'
                  >
                    <span className='text-slate-400 text-xs w-4 inline-block'>
                      {collapsed ? '▶' : '▼'}
                    </span>

                    <h3 className='text-sm font-bold uppercase tracking-wide text-slate-500'>
                      {group.category}
                    </h3>

                    <span className='bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 text-[11px] font-semibold'>
                      {group.count}
                    </span>

                    {group.overdue > 0 && (
                      <span className='bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-[11px] font-semibold'>
                        {group.overdue} overdue
                      </span>
                    )}

                    {group.done > 0 && (
                      <span className='bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-[11px] font-semibold'>
                        {group.done} done
                      </span>
                    )}

                    <div className='flex-1 h-px bg-slate-200' />
                  </button>

                  {!collapsed &&
                    group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isOverdue={isOverdue}
                        toggleTask={toggleTask}
                        removeTask={removeTask}
                        startEditTask={startEditTask}
                        selected={selectedIds.includes(task.id)}
                        toggleSelect={toggleSelect}
                      />
                    ))}
                </div>
              )
            })
          : filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isOverdue={isOverdue}
                toggleTask={toggleTask}
                removeTask={removeTask}
                startEditTask={startEditTask}
                selected={selectedIds.includes(task.id)}
                toggleSelect={toggleSelect}
              />
            ))}
      </div>

      {showDeleteModal && (
        <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
          <div className='bg-white rounded-3xl p-6 w-[90%] max-w-sm shadow-2xl'>
            <h3 className='text-lg font-semibold mb-2'>Delete Task?</h3>

            <p className='text-sm text-slate-500 mb-5'>
              Are you sure you want to delete this task? This action cannot be undone.
            </p>

            <div className='flex gap-3 justify-end'>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setTaskToDelete(null)
                }}
                className='px-4 py-2 rounded-xl bg-slate-200 text-sm'
              >
                Cancel
              </button>

              <button
                onClick={confirmDeleteTask}
                className='px-4 py-2 rounded-xl bg-red-500 text-white text-sm'
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {showBulkDeleteModal && (
        <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50'>
          <div className='bg-white rounded-3xl p-6 w-[90%] max-w-sm shadow-2xl'>
            <h3 className='text-lg font-semibold mb-2'>
              Delete {selectedIds.length} tasks?
            </h3>

            <p className='text-sm text-slate-500 mb-5'>
              This will permanently delete all {selectedIds.length} selected
              tasks. This action cannot be undone.
            </p>

            <div className='flex gap-3 justify-end'>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className='px-4 py-2 rounded-xl bg-slate-200 text-sm'
              >
                Cancel
              </button>

              <button
                onClick={confirmBulkDelete}
                className='px-4 py-2 rounded-xl bg-red-500 text-white text-sm'
              >
                Delete {selectedIds.length}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* Single task card. Extracted so the flat list and the grouped
   view render identical cards without duplicated JSX. */
function TaskCard({
  task,
  isOverdue,
  toggleTask,
  removeTask,
  startEditTask,
  selected,
  toggleSelect
}) {
  const overdue = isOverdue(task)
  return (
    <div
      className={`rounded-3xl p-4 border ${
        selected
          ? 'bg-blue-50 border-blue-400'
          : overdue
          ? 'bg-red-50 border-red-300'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex gap-3 flex-1'>
          <input
            type='checkbox'
            checked={selected}
            onChange={() => toggleSelect(task.id)}
            className='mt-1 w-4 h-4'
            title='Select for bulk actions'
          />

          <div className='flex-1'>
            <div className='flex flex-wrap gap-2 mb-2'>
              {task.category && (
                <span className='bg-slate-200 px-2 py-1 rounded-full text-[11px]'>
                  {task.category}
                </span>
              )}

              <span className='bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[11px]'>
                {task.status}
              </span>

              {task.completed && (
                <span className='bg-green-100 text-green-700 px-2 py-1 rounded-full text-[11px] font-semibold'>
                  Done
                </span>
              )}
            </div>

            <h3
              className={`text-lg font-semibold ${
                task.completed ? 'line-through opacity-50' : ''
              }`}
            >
              {task.title}
            </h3>

            {task.description && (
              <p className='text-sm text-slate-600 mt-2'>
                {task.description}
              </p>
            )}

            {task.link && (
              <a
                href={task.link}
                target='_blank'
                rel='noreferrer'
                className='text-blue-600 underline break-all text-sm mt-2 inline-block'
              >
                {task.link}
              </a>
            )}

            <div className='flex gap-2 flex-wrap mt-3'>
              <span className='bg-slate-200 px-2 py-1 rounded-full text-xs'>
                {task.priority}
              </span>

              {task.dueDate && (
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    overdue ? 'bg-red-200 text-red-800' : 'bg-slate-200'
                  }`}
                >
                  Due: {task.dueDate}
                </span>
              )}

              {overdue && (
                <span className='bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold'>
                  Overdue
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='flex flex-col gap-2 shrink-0'>
          <button
            onClick={() => toggleTask(task.id)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
              task.completed
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                : 'bg-green-600 hover:bg-green-500 text-white'
            }`}
          >
            {task.completed ? 'Reopen' : 'Mark Done'}
          </button>

          <button
            onClick={() => startEditTask(task)}
            className='bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl text-xs transition'
          >
            Edit
          </button>

          <button
            onClick={() => removeTask(task.id)}
            className='bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-xl text-xs transition'
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatPanel() {
  const [messages, setMessages] = useState([])

  const [message, setMessage] = useState('')
  /* The display name stays in localStorage: it is per-person, not shared. */
  const [name, setName] = useState(() => {
    return localStorage.getItem('workspace_name') || ''
  })

  const [editingName, setEditingName] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [editedText, setEditedText] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    localStorage.setItem('workspace_name', name)
  }, [name])

  /* Initial load + realtime for chat */
  useEffect(() => {
    let active = true

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!active) return

      if (error) {
        console.error('Error loading messages:', error)
      } else {
        /* fetched newest-first, reverse so oldest is at top */
        setMessages((data || []).map(messageFromRow).reverse())
      }
    }

    loadMessages()

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        loadMessages
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  const sendMessage = async () => {
    if (!message.trim()) return

    const { error } = await supabase.from('messages').insert({
      username: name || 'Anonymous',
      text: message,
      edited: false
    })

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    setMessage('')
  }

  const deleteMessage = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id)
    if (error) console.error('Error deleting message:', error)
  }

  const startEditingMessage = (msg) => {
    setEditingMessageId(msg.id)
    setEditedText(msg.text)
  }

  const saveEditedMessage = async (id) => {
    if (!editedText.trim()) return

    const { error } = await supabase
      .from('messages')
      .update({ text: editedText, edited: true })
      .eq('id', id)

    if (error) console.error('Error editing message:', error)

    setEditingMessageId(null)
    setEditedText('')
  }

  return (
    <aside className='bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-sm flex flex-col h-[70vh] lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]'>
      <div className='mb-4'>
        <h2 className='text-xl font-semibold'>Chat</h2>
      </div>

      <div className='bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 flex items-center justify-between mb-3'>
        <div>
          <p className='text-[10px] text-slate-500'>Logged in as</p>
          <p className='font-semibold text-sm'>{name || 'No name set'}</p>
        </div>

        <button
          onClick={() => setEditingName(!editingName)}
          className='bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-xl text-xs transition'
        >
          {editingName ? 'Close' : 'Edit'}
        </button>
      </div>

      {editingName && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Enter your name'
          className='border border-slate-300 rounded-xl px-3 py-2 text-sm mb-3'
        />
      )}

      <div className='flex-1 overflow-y-auto space-y-2 pr-1'>
        {messages.length === 0 && (
          <div className='text-center text-xs text-slate-400 py-8'>
            No messages yet.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className='bg-slate-50 border border-slate-200 rounded-2xl p-2.5'
          >
            <div className='flex items-center justify-between mb-1'>
              <p className='text-sm font-semibold text-blue-600'>
                {msg.sender}
              </p>

              <div className='flex items-center gap-2 relative'>
                <p className='text-[10px] text-slate-400'>
                  {msg.time}
                </p>

                <button
                  onClick={() =>
                    setOpenMenuId(openMenuId === msg.id ? null : msg.id)
                  }
                  className='text-slate-500 hover:text-slate-700 text-lg px-2 leading-none'
                >
                  ⋯
                </button>

                {openMenuId === msg.id && (
                  <div className='absolute top-5 right-0 bg-white border border-slate-200 shadow-lg rounded-xl py-1 w-24 z-10'>
                    <button
                      onClick={() => {
                        startEditingMessage(msg)
                        setOpenMenuId(null)
                      }}
                      className='w-full text-left px-3 py-2 text-xs hover:bg-slate-100'
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => {
                        deleteMessage(msg.id)
                        setOpenMenuId(null)
                      }}
                      className='w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-slate-100'
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {editingMessageId === msg.id ? (
              <div className='space-y-2'>
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className='w-full border border-slate-300 rounded-xl px-2 py-2 text-[13px] resize-none h-16'
                />

                <button
                  onClick={() => saveEditedMessage(msg.id)}
                  className='bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded-lg text-xs transition'
                >
                  Save
                </button>
              </div>
            ) : (
              <div>
                <p className='text-[13px] leading-snug break-words whitespace-pre-wrap'>
                  {msg.text}
                </p>

                {msg.edited && (
                  <p className='text-[10px] text-slate-400 mt-1 italic'>
                    edited
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className='mt-3 space-y-2'>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder='Type a message...'
          className='w-full h-14 resize-none border border-slate-300 rounded-2xl px-3 py-2 text-[13px]'
        />

        <button
          onClick={sendMessage}
          className='w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-2xl text-sm font-semibold transition'
        >
          Send
        </button>
      </div>
    </aside>
  )
}
